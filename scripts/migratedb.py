import argparse

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


old_db_pull_

new_db_register_flight = 'INSERT INTO public."flight-registry" (start_date, imei) values' \
                       '(\'{start_date}\', {imei})'

new_db_add_point = 'INSERT INTO public."flights" (uid, datetime, latitude, longitude, altitude, vertical_velocity,' \
                 'ground_speed, satellites) values ' \
                 '({uid}, \'{datetime}\', {lat}, {long}, {alt}, {vert_vel}, {speed}, {sats})'


def build_parser():
    pass

def create_new_db(conn, new_name, table_schemas):
    with conn as cursor:
        cursor.execute(f'CREATE DATABASE {new_name}')
        for schema_fp in table_schemas:
            cursor.execute(open(schema_fp, "r").read())


if __name__ == '__main__':
    print('Connecting to Helios DB...')
    conn = psycopg2.connect(user='Aurora',
                            password=pg_password,
                            host=HOST,
                            port='5432',
                            database='helios')
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)