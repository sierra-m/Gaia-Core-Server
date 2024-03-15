
-- Authentication Tokens
CREATE TABLE public.auth (
    "primary" integer NOT NULL DEFAULT nextval('auth_primary_seq'::regclass),
    client character varying(10) NOT NULL,
    token character varying(32) NOT NULL
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.auth
    OWNER to "Aurora";
COMMENT ON TABLE public.auth
    IS 'List of valid client/token pairs for authentication';


-- Modem information
CREATE TABLE public.modems (
    imei bigint NOT NULL,
    organization text NOT NULL,
    code text NOT NULL,
    CONSTRAINT imei_pkey PRIMARY KEY (imei),
    UNIQUE (code)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.modems
    OWNER to "Aurora";
COMMENT ON TABLE public.modems
    IS 'List of valid modems for allowable flight point insertions, for whitelisting and IMEI searching';


-- Flight registry
CREATE TABLE public."flight-registry"
(
    uid uuid NOT NULL DEFAULT gen_random_uuid(),
    start_date date NOT NULL,
    imei bigint NOT NULL,
    CONSTRAINT "flight-registry_pkey" PRIMARY KEY (uid),
    CONSTRAINT "Date Valid" CHECK (start_date > '2013-01-01'::date),
    CONSTRAINT "IMEI Valid" CHECK (imei > '0'::bigint)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."flight-registry"
    OWNER to "Aurora";
COMMENT ON TABLE public."flight-registry"
    IS 'Central flight data repository. Rows represent physical flights, where a flight is a collection of data points. The flight''s Unique Identifier (UID) is calculated using the v4 UUID standard.';


-- Flight points
CREATE TABLE public.flights
(
    primary_key bigint NOT NULL DEFAULT nextval('flights_primary_key_seq'::regclass),
    uid uuid NOT NULL,
    datetime timestamp without time zone NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    altitude real NOT NULL,
    vertical_velocity real NOT NULL,
    ground_speed real NOT NULL,
    satellites smallint,
    CONSTRAINT flights_pkey PRIMARY KEY (primary_key),
    CONSTRAINT "Datetime Valid" CHECK (datetime > '2013-01-01 00:00:00'::timestamp without time zone),
    CONSTRAINT "Altitude Positive" CHECK (altitude > 0::double precision),
    CONSTRAINT "Ground Speed Positive" CHECK (ground_speed >= 0::double precision),
    CONSTRAINT "Satellites Positive" CHECK (satellites >= 0)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.flights
    OWNER to "Aurora";
COMMENT ON TABLE public.flights
    IS 'Flight points repository. Flights are grouped entirely by UID and as such should be queried that way';