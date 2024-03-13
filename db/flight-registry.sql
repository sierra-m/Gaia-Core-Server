
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