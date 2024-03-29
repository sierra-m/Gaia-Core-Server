#!/usr/bin/python3
import argparse
import time
import multiprocessing
import functools

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


class Flight:
    def __init__(self, old_uid, start_date, imei, new_uid=None):
        self.old_uid = old_uid
        self.new_uid = new_uid
        self.start_date = start_date
        self.imei = imei

    @classmethod
    def from_db(cls, row):
        return cls(old_uid=row[0], start_date=row[1], imei=row[2])

    def timestring(self) -> str:
        return self.start_date.strftime('%Y-%m-%d %H:%M:%S')

    def __repr__(self):
        return f'{{start: {self.timestring()}, imei: {self.imei}}}'


class FlightPoint:
    def __init__(self, old_uid, timestamp, latitude, longitude, altitude, vertical_velocity, ground_speed, satellites, new_uid=None):
        self.old_uid = old_uid
        self.new_uid = new_uid
        self.timestamp = timestamp
        self.latitude = latitude
        self.longitude = longitude
        self.altitude = altitude
        self.vertical_velocity = vertical_velocity
        self.ground_speed = ground_speed
        self.satellites = satellites

    @classmethod
    def from_db(cls, row):
        # discard row[0] (primary key)
        return cls(old_uid=row[1],
                   timestamp=row[2],
                   latitude=row[3],
                   longitude=row[4],
                   altitude=row[5],
                   vertical_velocity=row[6],
                   ground_speed=row[7],
                   satellites=row[8])

    def timestring(self) -> str:
        return self.timestamp.strftime('%Y-%m-%d %H:%M:%S')


new_db_add_point = 'INSERT INTO public."flights" (uid, datetime, latitude, longitude, altitude, vertical_velocity,' \
                 'ground_speed, satellites) values ' \
                 '(\'{uid}\', \'{datetime}\', {lat}, {lng}, {alt}, {vert_vel}, {speed}, {sats})'


def print_progress_bar(iteration, total, prefix='', suffix='', decimals=1, length=100, fill='▊'):
    """
    Copied shamelessly from https://stackoverflow.com/a/34325723
    """
    percent = ("{0:." + str(decimals) + "f}").format(100 * (iteration / float(total)))
    filledLength = int(length * iteration // total)
    bar = fill * filledLength + '-' * (length - filledLength)
    print('\r%s |%s| %s%% %s' % (prefix, bar, percent, suffix), end='\r')
    # Print New Line on Complete
    if iteration == total:
        print()


def iter_progress(iterable, start=0, total=100, prefix='Progress:', suffix='Complete', precision=1, width=20):
    iterator = iter(iterable)

    for i in range(start, total):
        print_progress_bar(i, total, prefix, suffix, precision, width)
        yield next(iterator)

    print_progress_bar(total, total, prefix, suffix, precision, width)  # 100%


def timerunning(func):
    def wrapper(*args, **kwargs):
        start = time.time()
        func(*args, **kwargs)
        print('Operation completed in {} seconds.'.format(time.time() - start))
    return wrapper


def build_parser():
    parser = argparse.ArgumentParser(prog='migratedb',
                                     description='migrates old helios schema to new form')
    required_named = parser.add_argument_group('required named arguments')
    required_named.add_argument('-p', '--password', help='Helios db password', required=True)
    required_named.add_argument('-n', '--new-name', help='New database name', required=True)
    required_named.add_argument('-s', '--schema', help='New database schema', required=True)
    return parser


def create_new_db(old_conn, new_name, table_schema, pg_password):
    with old_conn.cursor() as old_cursor:
        old_cursor.execute(f'CREATE DATABASE {new_name}')
    new_conn = psycopg2.connect(user='postgres',
                                 password=pg_password,
                                 host='localhost',
                                 port='5432',
                                 database=new_name)
    with new_conn.cursor() as new_cursor:
        new_cursor.execute(open(table_schema, "r").read())
    print(f'Created new db "{new_name}"')
    return new_conn


def connect_to_db(pg_password):
    print('Connecting to Helios DB...')
    conn = psycopg2.connect(user='postgres',
                            password=pg_password,
                            host='localhost',
                            port='5432',
                            database='helios')
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    return conn


def register_auth_token(cursor, client, token):
    cursor.execute(f"INSERT INTO public.auth (client, token) VALUES ('{client}', '{token}')")


def register_flight(cursor, start_date: str, imei: int) -> str:
    cursor.execute(f'INSERT INTO public."flight-registry" (start_date, imei) values (\'{start_date}\', {imei}) RETURNING uid')
    found = cursor.fetchall()
    if len(found) == 1:
        return found[0][0]
    else:
        raise Exception(f'Found >1 UIDs for start_date {start_date}, imei {imei}: {found}')


def register_flight_point(cursor, point: FlightPoint):
    cursor.execute('BEGIN')
    try:
        cursor.execute(new_db_add_point.format(uid=point.new_uid,
                                               datetime=point.timestring(),
                                               lat=point.latitude,
                                               lng=point.longitude,
                                               alt=point.altitude,
                                               vert_vel=point.vertical_velocity,
                                               speed=point.ground_speed,
                                               sats=point.satellites))
        cursor.execute('COMMIT')
        return True
    except psycopg2.errors.UniqueViolation:
        cursor.execute('ROLLBACK')
        return False


def handle_flight_reg(flight, log, log_sema, old_conn, new_conn, discarded_points, discard_sema, points_count):
    with old_conn.cursor() as proc_old_cursor:
        with new_conn.cursor() as proc_new_cursor:
            flight.new_uid = register_flight(proc_new_cursor, start_date=flight.timestring(), imei=flight.imei)
            with log_sema:
                log.write(f'Reassigning flight {flight} from uid {flight.old_uid} to {flight.new_uid}\n')

            proc_old_cursor.execute(f"SELECT * FROM public.flights WHERE uid={flight.old_uid}")
            points = [FlightPoint.from_db(x) for x in old_cursor.fetchall()]

            for point in points:
                point.new_uid = flight.new_uid
                if not register_flight_point(proc_new_cursor, point):
                    with discard_sema:
                        discarded_points.append((point, flight.imei, flight.timestring()))
            points_count.value += len(points)


@timerunning
def migrate_db(old_cursor, new_cursor, old_conn, new_conn):
    old_cursor.execute('SELECT client, token FROM public.auth')
    auth_pairs = old_cursor.fetchall()
    for pair in auth_pairs:
        register_auth_token(new_cursor, client=pair[0], token=pair[1])

    old_cursor.execute('SELECT * FROM public."flight-registry"')
    flights = [Flight.from_db(x) for x in old_cursor.fetchall()]
    points_count = multiprocessing.Value('i', 0)
    discarded_points = []
    log_sema = multiprocessing.Semaphore(1)
    discard_sema = multiprocessing.Semaphore(1)
    with open('changelog.txt', 'w') as log:
        def partial_func(flight):
            handle_flight_reg(flight, log, log_sema, old_conn, new_conn, discarded_points, discard_sema, points_count)
        with multiprocessing.Pool(5) as p:
            p.imap(partial_func, iter_progress(flights, total=len(flights)), len(flights)/5)

        for (point, imei, start_date) in discarded_points:
            log.write(f'Duplicate: uid {point.new_uid}, datetime {point.timestring()}, imei {imei}, start {start_date}\n')

    print(f'Registered {points_count.value} unique points for {len(flights)} flights, discarded {len(discarded_points)}')
    print('Details logged to ./changelog.txt')


if __name__ == '__main__':
    parser = build_parser()
    args = parser.parse_args()

    if (args):
        old_db_conn = connect_to_db(args.password)
        new_db_conn = create_new_db(old_conn=old_db_conn,
                                    new_name=args.new_name,
                                    table_schema=args.schema,
                                    pg_password=args.password)
        print('Opened both databases, proceeding with migration')
        with old_db_conn.cursor() as old_cursor:
            with new_db_conn.cursor() as new_cursor:
                migrate_db(old_cursor, new_cursor, old_db_conn, new_db_conn)
                new_cursor.execute('COMMIT')
    else:
        parser.print_help()