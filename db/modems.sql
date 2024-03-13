
CREATE TABLE public.modems
(
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