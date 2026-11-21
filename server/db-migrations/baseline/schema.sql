-- Baseline: the whole RepLab database structure as of 2026-10-13, taken from
-- production (pg_dump --schema-only, Postgres 18). Used only to build a brand-new
-- database; on an existing one the baseline migration skips it. Never edit this
-- file — make every change as a new migration in server/db-migrations/.

-- Name: account_deletion_tokens; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.account_deletion_tokens (
    id integer NOT NULL,
    user_id integer,
    token_hash text NOT NULL,
    requested_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    request_ip text
);

-- Name: account_deletion_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.account_deletion_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: account_deletion_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.account_deletion_tokens_id_seq OWNED BY public.account_deletion_tokens.id;

-- Name: admin_settings; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.admin_settings (
    key text NOT NULL,
    value text NOT NULL
);

-- Name: ai_usage; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.ai_usage (
    id integer NOT NULL,
    user_id integer,
    input_tokens integer DEFAULT 0,
    output_tokens integer DEFAULT 0,
    model text,
    cost_cents numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: ai_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.ai_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: ai_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.ai_usage_id_seq OWNED BY public.ai_usage.id;

-- Name: announcements; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.announcements (
    id integer NOT NULL,
    message text NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.announcements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;

-- Name: app_installs; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.app_installs (
    id integer NOT NULL,
    install_id text NOT NULL,
    platform text NOT NULL,
    app_version text,
    user_id integer,
    created_at timestamp with time zone DEFAULT now(),
    linked_at timestamp with time zone
);

-- Name: app_installs_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.app_installs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: app_installs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.app_installs_id_seq OWNED BY public.app_installs.id;

-- Name: cardio_entries; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.cardio_entries (
    id integer NOT NULL,
    user_id integer NOT NULL,
    session_id integer,
    cardio_type text NOT NULL,
    duration_secs integer NOT NULL,
    distance_m numeric,
    calories integer,
    avg_heart_rate integer,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: cardio_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.cardio_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: cardio_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.cardio_entries_id_seq OWNED BY public.cardio_entries.id;

-- Name: challenge_entries; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.challenge_entries (
    id integer NOT NULL,
    user_id integer NOT NULL,
    challenge text NOT NULL,
    value integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: challenge_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.challenge_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: challenge_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.challenge_entries_id_seq OWNED BY public.challenge_entries.id;

-- Name: code_errors; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.code_errors (
    id integer NOT NULL,
    fingerprint text NOT NULL,
    source text NOT NULL,
    kind text NOT NULL,
    name text,
    code text,
    message text NOT NULL,
    location text,
    route text,
    sample_stack text,
    context text,
    count integer DEFAULT 1 NOT NULL,
    first_seen timestamp with time zone DEFAULT now() NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    last_user_id integer,
    app_version text,
    status text DEFAULT 'open'::text NOT NULL,
    reopened boolean DEFAULT false NOT NULL,
    note text
);

-- Name: code_errors_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.code_errors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: code_errors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.code_errors_id_seq OWNED BY public.code_errors.id;

-- Name: community_hidden_before; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.community_hidden_before (
    user_id integer NOT NULL,
    category text NOT NULL,
    hidden_before timestamp with time zone NOT NULL
);

-- Name: community_like_notices; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.community_like_notices (
    user_id integer NOT NULL,
    item_type text NOT NULL,
    item_id integer NOT NULL,
    owner_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notified_at timestamp with time zone,
    pushed boolean DEFAULT false NOT NULL
);

-- Name: community_likes; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.community_likes (
    id integer NOT NULL,
    user_id integer NOT NULL,
    item_type text NOT NULL,
    item_id integer NOT NULL,
    owner_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: community_likes_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.community_likes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: community_likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.community_likes_id_seq OWNED BY public.community_likes.id;

-- Name: community_sharing_periods; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.community_sharing_periods (
    id integer NOT NULL,
    user_id integer NOT NULL,
    category text NOT NULL,
    off_at timestamp with time zone DEFAULT now() NOT NULL,
    on_at timestamp with time zone
);

-- Name: community_sharing_periods_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.community_sharing_periods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: community_sharing_periods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.community_sharing_periods_id_seq OWNED BY public.community_sharing_periods.id;

-- Name: custom_workout_events; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.custom_workout_events (
    id integer NOT NULL,
    user_id integer NOT NULL,
    template_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: custom_workout_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.custom_workout_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: custom_workout_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.custom_workout_events_id_seq OWNED BY public.custom_workout_events.id;

-- Name: device_tokens; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.device_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    push_token text NOT NULL,
    platform text DEFAULT 'ios'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Name: device_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.device_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: device_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.device_tokens_id_seq OWNED BY public.device_tokens.id;

-- Name: email_templates; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.email_templates (
    id integer NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    html text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

-- Name: email_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.email_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: email_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.email_templates_id_seq OWNED BY public.email_templates.id;

-- Name: exercise_favorites; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.exercise_favorites (
    user_id integer NOT NULL,
    exercise_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: exercises; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.exercises (
    id integer NOT NULL,
    name text NOT NULL,
    muscle_group text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    is_custom boolean DEFAULT false,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    video_id text,
    video_linked_by text,
    hidden_from_library boolean DEFAULT false NOT NULL,
    video_review text
);

-- Name: exercises_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.exercises_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: exercises_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.exercises_id_seq OWNED BY public.exercises.id;

-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.feature_flags (
    key text NOT NULL,
    enabled boolean DEFAULT false,
    description text DEFAULT ''::text
);

-- Name: feed_reactions; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.feed_reactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    item_id text NOT NULL,
    reaction text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: feed_reactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.feed_reactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: feed_reactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.feed_reactions_id_seq OWNED BY public.feed_reactions.id;

-- Name: feedback; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.feedback (
    id integer NOT NULL,
    user_id integer,
    type text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.feedback_id_seq OWNED BY public.feedback.id;

-- Name: page_visits; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.page_visits (
    id integer NOT NULL,
    user_id integer,
    path text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: page_visits_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.page_visits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: page_visits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.page_visits_id_seq OWNED BY public.page_visits.id;

-- Name: password_reset_log; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.password_reset_log (
    id integer NOT NULL,
    user_id integer,
    token_hash text NOT NULL,
    requested_at timestamp with time zone DEFAULT now(),
    used_at timestamp with time zone,
    request_ip text,
    use_ip text,
    user_agent text
);

-- Name: password_reset_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.password_reset_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: password_reset_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.password_reset_log_id_seq OWNED BY public.password_reset_log.id;

-- Name: personal_bests; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.personal_bests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    template_id integer,
    exercise_name text NOT NULL,
    best_weight numeric NOT NULL,
    best_reps integer NOT NULL,
    achieved_at timestamp with time zone DEFAULT now(),
    exercise_id integer
);

-- Name: personal_bests_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.personal_bests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: personal_bests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.personal_bests_id_seq OWNED BY public.personal_bests.id;

-- Name: pro_waiting_list; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.pro_waiting_list (
    id integer NOT NULL,
    email text NOT NULL,
    user_id integer,
    source text DEFAULT 'email'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: pro_waiting_list_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.pro_waiting_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: pro_waiting_list_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.pro_waiting_list_id_seq OWNED BY public.pro_waiting_list.id;

-- Name: program_name_abbreviations; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.program_name_abbreviations (
    full_name text NOT NULL,
    short_name text NOT NULL
);

-- Name: program_starts; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.program_starts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    program_id integer,
    program_name text NOT NULL,
    started_at timestamp with time zone DEFAULT now()
);

-- Name: program_starts_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.program_starts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: program_starts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.program_starts_id_seq OWNED BY public.program_starts.id;

-- Name: programs; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.programs (
    id integer NOT NULL,
    user_id integer,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    description text DEFAULT ''::text,
    sort_order integer DEFAULT 0,
    program_type text DEFAULT 'other'::text,
    is_featured boolean DEFAULT false,
    cardio_acceleration_enabled boolean DEFAULT false,
    program_details jsonb
);

-- Name: programs_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.programs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: programs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.programs_id_seq OWNED BY public.programs.id;

-- Name: schedule_days; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.schedule_days (
    id integer NOT NULL,
    user_id integer NOT NULL,
    day_of_week integer,
    template_id integer,
    schedule_date date,
    is_rest boolean DEFAULT false,
    missed_skipped_at timestamp with time zone
);

-- Name: schedule_days_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.schedule_days_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: schedule_days_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.schedule_days_id_seq OWNED BY public.schedule_days.id;

-- Name: session_entries; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.session_entries (
    id integer NOT NULL,
    session_id integer NOT NULL,
    exercise_name text NOT NULL,
    set_number integer NOT NULL,
    weight numeric DEFAULT 0,
    reps integer DEFAULT 0,
    is_completed boolean DEFAULT false,
    exercise_id integer,
    cardio_metric text,
    cardio_value numeric
);

-- Name: session_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.session_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: session_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.session_entries_id_seq OWNED BY public.session_entries.id;

-- Name: sessions; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    template_id integer,
    date text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    notes jsonb DEFAULT '{}'::jsonb,
    completed boolean DEFAULT false,
    workout_data jsonb,
    last_activity_at timestamp with time zone,
    reminder_sent_at timestamp with time zone,
    custom_name text
);

-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;

-- Name: shared_programs; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.shared_programs (
    id integer NOT NULL,
    source_program_id integer,
    sender_id integer NOT NULL,
    recipient_id integer NOT NULL,
    copied_program_id integer,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    type text DEFAULT 'program'::text,
    template_id integer,
    message text
);

-- Name: shared_programs_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.shared_programs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: shared_programs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.shared_programs_id_seq OWNED BY public.shared_programs.id;

-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.subscriptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    stripe_subscription_id text,
    stripe_customer_id text,
    source text DEFAULT 'stripe'::text NOT NULL,
    plan text NOT NULL,
    billing_interval text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    current_period_end timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;

-- Name: template_exercises; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.template_exercises (
    id integer NOT NULL,
    template_id integer,
    name text NOT NULL,
    set_number integer NOT NULL,
    planned_reps integer DEFAULT 10,
    suggested_weight numeric DEFAULT 0,
    sort_order integer DEFAULT 0,
    set_type text DEFAULT 'straight'::text,
    rep_range text DEFAULT ''::text,
    exercise_description text DEFAULT ''::text,
    is_section_header boolean DEFAULT false,
    section_notes text DEFAULT ''::text,
    video_url text DEFAULT ''::text,
    program_notes text DEFAULT ''::text,
    exercise_id integer
);

-- Name: template_exercises_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.template_exercises_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: template_exercises_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.template_exercises_id_seq OWNED BY public.template_exercises.id;

-- Name: templates; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.templates (
    id integer NOT NULL,
    user_id integer,
    program_id integer,
    name text NOT NULL,
    description text DEFAULT ''::text,
    is_rest boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    group_id text,
    phase text,
    prehab_template_id integer,
    is_prehab boolean DEFAULT false
);

-- Name: templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.templates_id_seq OWNED BY public.templates.id;

-- Name: trainer_applications; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.trainer_applications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    message text DEFAULT ''::text,
    status text DEFAULT 'pending'::text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: trainer_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.trainer_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: trainer_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.trainer_applications_id_seq OWNED BY public.trainer_applications.id;

-- Name: trainer_clients; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.trainer_clients (
    id integer NOT NULL,
    trainer_id integer NOT NULL,
    client_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: trainer_clients_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.trainer_clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: trainer_clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.trainer_clients_id_seq OWNED BY public.trainer_clients.id;

-- Name: trainer_login_history; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.trainer_login_history (
    id integer NOT NULL,
    user_id integer,
    email text,
    ip text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    city text,
    state text
);

-- Name: trainer_login_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.trainer_login_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: trainer_login_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.trainer_login_history_id_seq OWNED BY public.trainer_login_history.id;

-- Name: trainer_sessions; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.trainer_sessions (
    id integer NOT NULL,
    token_hash text NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL
);

-- Name: trainer_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.trainer_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: trainer_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.trainer_sessions_id_seq OWNED BY public.trainer_sessions.id;

-- Name: user_identities; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.user_identities (
    id integer NOT NULL,
    user_id integer NOT NULL,
    provider text NOT NULL,
    provider_uid text NOT NULL,
    email text,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: user_identities_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.user_identities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: user_identities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.user_identities_id_seq OWNED BY public.user_identities.id;

-- Name: user_login_history; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.user_login_history (
    id integer NOT NULL,
    user_id integer,
    email text,
    ip text,
    user_agent text,
    city text,
    state text,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: user_login_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.user_login_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: user_login_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.user_login_history_id_seq OWNED BY public.user_login_history.id;

-- Name: user_metrics; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.user_metrics (
    user_id integer NOT NULL,
    height numeric,
    weight numeric,
    body_fat numeric,
    max_bench numeric,
    max_squat numeric,
    max_deadlift numeric,
    updated_at timestamp with time zone DEFAULT now()
);

-- Name: users_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.users_account_id_seq
    START WITH 23231
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: users; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.users (
    id integer NOT NULL,
    email text,
    password_hash text,
    created_at timestamp with time zone DEFAULT now(),
    phone text,
    first_name text,
    last_name text,
    gender text,
    username text,
    referral_source text,
    referral_code text,
    signup_city text,
    signup_state text,
    reset_token text,
    reset_token_expires timestamp with time zone,
    zip_code text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    utm_term text,
    signup_device text,
    plan text DEFAULT 'Free'::text,
    trial_end timestamp with time zone,
    profile_photo text,
    stripe_customer_id text,
    role text DEFAULT 'client'::text,
    token_version integer DEFAULT 0 NOT NULL,
    timezone text DEFAULT 'UTC'::text,
    account_id integer DEFAULT nextval('public.users_account_id_seq'::regclass),
    last_streak_reminder_at timestamp with time zone,
    welcomed_at timestamp with time zone,
    last_weekly_summary_at timestamp with time zone,
    locale text DEFAULT 'en'::text,
    notify_community_likes boolean DEFAULT true NOT NULL,
    CONSTRAINT users_locale_check CHECK ((locale = ANY (ARRAY['en'::text, 'es'::text])))
);

-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

-- Name: account_deletion_tokens id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.account_deletion_tokens ALTER COLUMN id SET DEFAULT nextval('public.account_deletion_tokens_id_seq'::regclass);

-- Name: ai_usage id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.ai_usage ALTER COLUMN id SET DEFAULT nextval('public.ai_usage_id_seq'::regclass);

-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);

-- Name: app_installs id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.app_installs ALTER COLUMN id SET DEFAULT nextval('public.app_installs_id_seq'::regclass);

-- Name: cardio_entries id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.cardio_entries ALTER COLUMN id SET DEFAULT nextval('public.cardio_entries_id_seq'::regclass);

-- Name: challenge_entries id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.challenge_entries ALTER COLUMN id SET DEFAULT nextval('public.challenge_entries_id_seq'::regclass);

-- Name: code_errors id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.code_errors ALTER COLUMN id SET DEFAULT nextval('public.code_errors_id_seq'::regclass);

-- Name: community_likes id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.community_likes ALTER COLUMN id SET DEFAULT nextval('public.community_likes_id_seq'::regclass);

-- Name: community_sharing_periods id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.community_sharing_periods ALTER COLUMN id SET DEFAULT nextval('public.community_sharing_periods_id_seq'::regclass);

-- Name: custom_workout_events id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.custom_workout_events ALTER COLUMN id SET DEFAULT nextval('public.custom_workout_events_id_seq'::regclass);

-- Name: device_tokens id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.device_tokens ALTER COLUMN id SET DEFAULT nextval('public.device_tokens_id_seq'::regclass);

-- Name: email_templates id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.email_templates ALTER COLUMN id SET DEFAULT nextval('public.email_templates_id_seq'::regclass);

-- Name: exercises id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.exercises ALTER COLUMN id SET DEFAULT nextval('public.exercises_id_seq'::regclass);

-- Name: feed_reactions id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.feed_reactions ALTER COLUMN id SET DEFAULT nextval('public.feed_reactions_id_seq'::regclass);

-- Name: feedback id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.feedback ALTER COLUMN id SET DEFAULT nextval('public.feedback_id_seq'::regclass);

-- Name: page_visits id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.page_visits ALTER COLUMN id SET DEFAULT nextval('public.page_visits_id_seq'::regclass);

-- Name: password_reset_log id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.password_reset_log ALTER COLUMN id SET DEFAULT nextval('public.password_reset_log_id_seq'::regclass);

-- Name: personal_bests id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.personal_bests ALTER COLUMN id SET DEFAULT nextval('public.personal_bests_id_seq'::regclass);

-- Name: pro_waiting_list id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.pro_waiting_list ALTER COLUMN id SET DEFAULT nextval('public.pro_waiting_list_id_seq'::regclass);

-- Name: program_starts id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.program_starts ALTER COLUMN id SET DEFAULT nextval('public.program_starts_id_seq'::regclass);

-- Name: programs id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.programs ALTER COLUMN id SET DEFAULT nextval('public.programs_id_seq'::regclass);

-- Name: schedule_days id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.schedule_days ALTER COLUMN id SET DEFAULT nextval('public.schedule_days_id_seq'::regclass);

-- Name: session_entries id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.session_entries ALTER COLUMN id SET DEFAULT nextval('public.session_entries_id_seq'::regclass);

-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);

-- Name: shared_programs id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.shared_programs ALTER COLUMN id SET DEFAULT nextval('public.shared_programs_id_seq'::regclass);

-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);

-- Name: template_exercises id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.template_exercises ALTER COLUMN id SET DEFAULT nextval('public.template_exercises_id_seq'::regclass);

-- Name: templates id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.templates ALTER COLUMN id SET DEFAULT nextval('public.templates_id_seq'::regclass);

-- Name: trainer_applications id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_applications ALTER COLUMN id SET DEFAULT nextval('public.trainer_applications_id_seq'::regclass);

-- Name: trainer_clients id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_clients ALTER COLUMN id SET DEFAULT nextval('public.trainer_clients_id_seq'::regclass);

-- Name: trainer_login_history id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_login_history ALTER COLUMN id SET DEFAULT nextval('public.trainer_login_history_id_seq'::regclass);

-- Name: trainer_sessions id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_sessions ALTER COLUMN id SET DEFAULT nextval('public.trainer_sessions_id_seq'::regclass);

-- Name: user_identities id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_identities ALTER COLUMN id SET DEFAULT nextval('public.user_identities_id_seq'::regclass);

-- Name: user_login_history id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_login_history ALTER COLUMN id SET DEFAULT nextval('public.user_login_history_id_seq'::regclass);

-- Name: users id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

-- Name: account_deletion_tokens account_deletion_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.account_deletion_tokens
    ADD CONSTRAINT account_deletion_tokens_pkey PRIMARY KEY (id);

-- Name: admin_settings admin_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (key);

-- Name: ai_usage ai_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);

-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);

-- Name: app_installs app_installs_install_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.app_installs
    ADD CONSTRAINT app_installs_install_id_key UNIQUE (install_id);

-- Name: app_installs app_installs_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.app_installs
    ADD CONSTRAINT app_installs_pkey PRIMARY KEY (id);

-- Name: cardio_entries cardio_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cardio_entries
    ADD CONSTRAINT cardio_entries_pkey PRIMARY KEY (id);

-- Name: challenge_entries challenge_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.challenge_entries
    ADD CONSTRAINT challenge_entries_pkey PRIMARY KEY (id);

-- Name: code_errors code_errors_fingerprint_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.code_errors
    ADD CONSTRAINT code_errors_fingerprint_key UNIQUE (fingerprint);

-- Name: code_errors code_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.code_errors
    ADD CONSTRAINT code_errors_pkey PRIMARY KEY (id);

-- Name: community_hidden_before community_hidden_before_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.community_hidden_before
    ADD CONSTRAINT community_hidden_before_pkey PRIMARY KEY (user_id, category);

-- Name: community_like_notices community_like_notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.community_like_notices
    ADD CONSTRAINT community_like_notices_pkey PRIMARY KEY (user_id, item_type, item_id);

-- Name: community_likes community_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.community_likes
    ADD CONSTRAINT community_likes_pkey PRIMARY KEY (id);

-- Name: community_likes community_likes_user_id_item_type_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.community_likes
    ADD CONSTRAINT community_likes_user_id_item_type_item_id_key UNIQUE (user_id, item_type, item_id);

-- Name: community_sharing_periods community_sharing_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.community_sharing_periods
    ADD CONSTRAINT community_sharing_periods_pkey PRIMARY KEY (id);

-- Name: custom_workout_events custom_workout_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.custom_workout_events
    ADD CONSTRAINT custom_workout_events_pkey PRIMARY KEY (id);

-- Name: device_tokens device_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);

-- Name: device_tokens device_tokens_push_token_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_push_token_key UNIQUE (push_token);

-- Name: email_templates email_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_name_key UNIQUE (name);

-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);

-- Name: exercise_favorites exercise_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.exercise_favorites
    ADD CONSTRAINT exercise_favorites_pkey PRIMARY KEY (user_id, exercise_id);

-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);

-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (key);

-- Name: feed_reactions feed_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.feed_reactions
    ADD CONSTRAINT feed_reactions_pkey PRIMARY KEY (id);

-- Name: feed_reactions feed_reactions_user_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.feed_reactions
    ADD CONSTRAINT feed_reactions_user_id_item_id_key UNIQUE (user_id, item_id);

-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);

-- Name: page_visits page_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.page_visits
    ADD CONSTRAINT page_visits_pkey PRIMARY KEY (id);

-- Name: password_reset_log password_reset_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.password_reset_log
    ADD CONSTRAINT password_reset_log_pkey PRIMARY KEY (id);

-- Name: personal_bests personal_bests_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.personal_bests
    ADD CONSTRAINT personal_bests_pkey PRIMARY KEY (id);

-- Name: pro_waiting_list pro_waiting_list_email_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.pro_waiting_list
    ADD CONSTRAINT pro_waiting_list_email_key UNIQUE (email);

-- Name: pro_waiting_list pro_waiting_list_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.pro_waiting_list
    ADD CONSTRAINT pro_waiting_list_pkey PRIMARY KEY (id);

-- Name: program_name_abbreviations program_name_abbreviations_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.program_name_abbreviations
    ADD CONSTRAINT program_name_abbreviations_pkey PRIMARY KEY (full_name);

-- Name: program_starts program_starts_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.program_starts
    ADD CONSTRAINT program_starts_pkey PRIMARY KEY (id);

-- Name: programs programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_pkey PRIMARY KEY (id);

-- Name: schedule_days schedule_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.schedule_days
    ADD CONSTRAINT schedule_days_pkey PRIMARY KEY (id);

-- Name: session_entries session_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.session_entries
    ADD CONSTRAINT session_entries_pkey PRIMARY KEY (id);

-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

-- Name: shared_programs shared_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.shared_programs
    ADD CONSTRAINT shared_programs_pkey PRIMARY KEY (id);

-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);

-- Name: subscriptions subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);

-- Name: template_exercises template_exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.template_exercises
    ADD CONSTRAINT template_exercises_pkey PRIMARY KEY (id);

-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);

-- Name: trainer_applications trainer_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_applications
    ADD CONSTRAINT trainer_applications_pkey PRIMARY KEY (id);

-- Name: trainer_clients trainer_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_clients
    ADD CONSTRAINT trainer_clients_pkey PRIMARY KEY (id);

-- Name: trainer_clients trainer_clients_trainer_id_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_clients
    ADD CONSTRAINT trainer_clients_trainer_id_client_id_key UNIQUE (trainer_id, client_id);

-- Name: trainer_login_history trainer_login_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_login_history
    ADD CONSTRAINT trainer_login_history_pkey PRIMARY KEY (id);

-- Name: trainer_sessions trainer_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_sessions
    ADD CONSTRAINT trainer_sessions_pkey PRIMARY KEY (id);

-- Name: trainer_sessions trainer_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_sessions
    ADD CONSTRAINT trainer_sessions_token_hash_key UNIQUE (token_hash);

-- Name: user_identities user_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_pkey PRIMARY KEY (id);

-- Name: user_identities user_identities_provider_provider_uid_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_provider_provider_uid_key UNIQUE (provider, provider_uid);

-- Name: user_login_history user_login_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_login_history
    ADD CONSTRAINT user_login_history_pkey PRIMARY KEY (id);

-- Name: user_metrics user_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_metrics
    ADD CONSTRAINT user_metrics_pkey PRIMARY KEY (user_id);

-- Name: users users_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_account_id_key UNIQUE (account_id);

-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);

-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);

-- Name: community_sharing_periods_one_open; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX community_sharing_periods_one_open ON public.community_sharing_periods USING btree (user_id, category) WHERE (on_at IS NULL);

-- Name: exercises_master_name_unique; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX exercises_master_name_unique ON public.exercises USING btree (lower(name)) WHERE (created_by IS NULL);

-- Name: idx_account_deletion_tokens_hash; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_account_deletion_tokens_hash ON public.account_deletion_tokens USING btree (token_hash);

-- Name: idx_account_deletion_tokens_user; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_account_deletion_tokens_user ON public.account_deletion_tokens USING btree (user_id);

-- Name: idx_ai_usage_user_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_ai_usage_user_id ON public.ai_usage USING btree (user_id);

-- Name: idx_app_installs_created; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_app_installs_created ON public.app_installs USING btree (created_at);

-- Name: idx_app_installs_user; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_app_installs_user ON public.app_installs USING btree (user_id);

-- Name: idx_cardio_entries_user_session; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_cardio_entries_user_session ON public.cardio_entries USING btree (user_id, session_id);

-- Name: idx_cardio_entries_user_type; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_cardio_entries_user_type ON public.cardio_entries USING btree (user_id, cardio_type);

-- Name: idx_challenge_entries_user_challenge; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_challenge_entries_user_challenge ON public.challenge_entries USING btree (user_id, challenge);

-- Name: idx_code_errors_last_seen; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_code_errors_last_seen ON public.code_errors USING btree (last_seen DESC);

-- Name: idx_community_like_notices_item; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_community_like_notices_item ON public.community_like_notices USING btree (item_type, item_id, notified_at);

-- Name: idx_community_like_notices_pending; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_community_like_notices_pending ON public.community_like_notices USING btree (created_at) WHERE (notified_at IS NULL);

-- Name: idx_community_likes_item; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_community_likes_item ON public.community_likes USING btree (item_type, item_id);

-- Name: idx_community_sharing_periods_user; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_community_sharing_periods_user ON public.community_sharing_periods USING btree (user_id, category);

-- Name: idx_custom_workout_events_created; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_custom_workout_events_created ON public.custom_workout_events USING btree (created_at);

-- Name: idx_device_tokens_user_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_device_tokens_user_id ON public.device_tokens USING btree (user_id);

-- Name: idx_exercises_created_by; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_exercises_created_by ON public.exercises USING btree (created_by);

-- Name: idx_feed_reactions_item; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_feed_reactions_item ON public.feed_reactions USING btree (item_id);

-- Name: idx_feedback_user_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_feedback_user_id ON public.feedback USING btree (user_id);

-- Name: idx_page_visits_created; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_page_visits_created ON public.page_visits USING btree (created_at);

-- Name: idx_page_visits_user; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_page_visits_user ON public.page_visits USING btree (user_id);

-- Name: idx_password_reset_log_token; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_password_reset_log_token ON public.password_reset_log USING btree (token_hash);

-- Name: idx_password_reset_log_user; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_password_reset_log_user ON public.password_reset_log USING btree (user_id);

-- Name: idx_personal_bests_exercise_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_personal_bests_exercise_id ON public.personal_bests USING btree (exercise_id);

-- Name: idx_personal_bests_lookup; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_personal_bests_lookup ON public.personal_bests USING btree (user_id, template_id, exercise_name, best_weight);

-- Name: idx_personal_bests_upsert; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX idx_personal_bests_upsert ON public.personal_bests USING btree (user_id, template_id, exercise_name, best_weight);

-- Name: idx_personal_bests_user_achieved; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_personal_bests_user_achieved ON public.personal_bests USING btree (user_id, achieved_at);

-- Name: idx_personal_bests_user_template; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_personal_bests_user_template ON public.personal_bests USING btree (user_id, template_id);

-- Name: idx_pro_waiting_list_user; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_pro_waiting_list_user ON public.pro_waiting_list USING btree (user_id);

-- Name: idx_program_starts_started; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_program_starts_started ON public.program_starts USING btree (started_at);

-- Name: idx_program_starts_user_program; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_program_starts_user_program ON public.program_starts USING btree (user_id, program_id);

-- Name: idx_programs_user_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_programs_user_id ON public.programs USING btree (user_id);

-- Name: idx_programs_user_lower_name; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX idx_programs_user_lower_name ON public.programs USING btree (user_id, lower(name)) WHERE (user_id IS NOT NULL);

-- Name: idx_schedule_days_user_date; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX idx_schedule_days_user_date ON public.schedule_days USING btree (user_id, schedule_date);

-- Name: idx_schedule_days_user_day; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX idx_schedule_days_user_day ON public.schedule_days USING btree (user_id, day_of_week);

-- Name: idx_schedule_days_user_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_schedule_days_user_id ON public.schedule_days USING btree (user_id);

-- Name: idx_session_entries_exercise_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_session_entries_exercise_id ON public.session_entries USING btree (exercise_id);

-- Name: idx_session_entries_session_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_session_entries_session_id ON public.session_entries USING btree (session_id);

-- Name: idx_sessions_completed_lookup; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_sessions_completed_lookup ON public.sessions USING btree (user_id, template_id) WHERE (completed = true);

-- Name: idx_sessions_created_at; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_sessions_created_at ON public.sessions USING btree (created_at);

-- Name: idx_sessions_idle_reminder; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_sessions_idle_reminder ON public.sessions USING btree (last_activity_at) WHERE ((completed = false) AND (reminder_sent_at IS NULL));

-- Name: idx_sessions_user_created_at; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_sessions_user_created_at ON public.sessions USING btree (user_id, created_at);

-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);

-- Name: idx_sessions_user_template_date; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_sessions_user_template_date ON public.sessions USING btree (user_id, template_id, date);

-- Name: idx_shared_programs_recipient; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_shared_programs_recipient ON public.shared_programs USING btree (recipient_id, status);

-- Name: idx_template_exercises_exercise_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_template_exercises_exercise_id ON public.template_exercises USING btree (exercise_id);

-- Name: idx_template_exercises_template_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_template_exercises_template_id ON public.template_exercises USING btree (template_id);

-- Name: idx_templates_program_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_templates_program_id ON public.templates USING btree (program_id);

-- Name: idx_templates_user_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_templates_user_id ON public.templates USING btree (user_id);

-- Name: idx_trainer_applications_status; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_trainer_applications_status ON public.trainer_applications USING btree (status);

-- Name: idx_trainer_applications_user; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_trainer_applications_user ON public.trainer_applications USING btree (user_id);

-- Name: idx_trainer_clients_client; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_trainer_clients_client ON public.trainer_clients USING btree (client_id);

-- Name: idx_trainer_clients_trainer; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_trainer_clients_trainer ON public.trainer_clients USING btree (trainer_id);

-- Name: idx_trainer_sessions_expires; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_trainer_sessions_expires ON public.trainer_sessions USING btree (expires_at);

-- Name: idx_trainer_sessions_token; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_trainer_sessions_token ON public.trainer_sessions USING btree (token_hash);

-- Name: idx_user_identities_user; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_user_identities_user ON public.user_identities USING btree (user_id);

-- Name: idx_user_login_history_created; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_user_login_history_created ON public.user_login_history USING btree (created_at);

-- Name: idx_user_login_history_user; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_user_login_history_user ON public.user_login_history USING btree (user_id);

-- Name: idx_users_reset_token; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_users_reset_token ON public.users USING btree (reset_token) WHERE (reset_token IS NOT NULL);

-- Name: account_deletion_tokens account_deletion_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.account_deletion_tokens
    ADD CONSTRAINT account_deletion_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: ai_usage ai_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Name: app_installs app_installs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.app_installs
    ADD CONSTRAINT app_installs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Name: cardio_entries cardio_entries_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cardio_entries
    ADD CONSTRAINT cardio_entries_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

-- Name: cardio_entries cardio_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.cardio_entries
    ADD CONSTRAINT cardio_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: challenge_entries challenge_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.challenge_entries
    ADD CONSTRAINT challenge_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: community_hidden_before community_hidden_before_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.community_hidden_before
    ADD CONSTRAINT community_hidden_before_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: community_like_notices community_like_notices_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.community_like_notices
    ADD CONSTRAINT community_like_notices_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: community_like_notices community_like_notices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.community_like_notices
    ADD CONSTRAINT community_like_notices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: community_likes community_likes_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.community_likes
    ADD CONSTRAINT community_likes_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: community_likes community_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.community_likes
    ADD CONSTRAINT community_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: community_sharing_periods community_sharing_periods_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.community_sharing_periods
    ADD CONSTRAINT community_sharing_periods_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: custom_workout_events custom_workout_events_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.custom_workout_events
    ADD CONSTRAINT custom_workout_events_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;

-- Name: custom_workout_events custom_workout_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.custom_workout_events
    ADD CONSTRAINT custom_workout_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: device_tokens device_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: exercise_favorites exercise_favorites_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.exercise_favorites
    ADD CONSTRAINT exercise_favorites_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE;

-- Name: exercise_favorites exercise_favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.exercise_favorites
    ADD CONSTRAINT exercise_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: exercises exercises_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Name: feed_reactions feed_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.feed_reactions
    ADD CONSTRAINT feed_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: feedback feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Name: page_visits page_visits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.page_visits
    ADD CONSTRAINT page_visits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: password_reset_log password_reset_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.password_reset_log
    ADD CONSTRAINT password_reset_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: personal_bests personal_bests_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.personal_bests
    ADD CONSTRAINT personal_bests_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE SET NULL;

-- Name: personal_bests personal_bests_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.personal_bests
    ADD CONSTRAINT personal_bests_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;

-- Name: personal_bests personal_bests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.personal_bests
    ADD CONSTRAINT personal_bests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Name: pro_waiting_list pro_waiting_list_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.pro_waiting_list
    ADD CONSTRAINT pro_waiting_list_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Name: program_starts program_starts_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.program_starts
    ADD CONSTRAINT program_starts_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE SET NULL;

-- Name: program_starts program_starts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.program_starts
    ADD CONSTRAINT program_starts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: programs programs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Name: schedule_days schedule_days_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.schedule_days
    ADD CONSTRAINT schedule_days_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;

-- Name: schedule_days schedule_days_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.schedule_days
    ADD CONSTRAINT schedule_days_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Name: session_entries session_entries_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.session_entries
    ADD CONSTRAINT session_entries_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE SET NULL;

-- Name: session_entries session_entries_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.session_entries
    ADD CONSTRAINT session_entries_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

-- Name: sessions sessions_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE SET NULL;

-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Name: shared_programs shared_programs_copied_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.shared_programs
    ADD CONSTRAINT shared_programs_copied_program_id_fkey FOREIGN KEY (copied_program_id) REFERENCES public.programs(id) ON DELETE SET NULL;

-- Name: shared_programs shared_programs_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.shared_programs
    ADD CONSTRAINT shared_programs_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: shared_programs shared_programs_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.shared_programs
    ADD CONSTRAINT shared_programs_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: shared_programs shared_programs_source_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.shared_programs
    ADD CONSTRAINT shared_programs_source_program_id_fkey FOREIGN KEY (source_program_id) REFERENCES public.programs(id) ON DELETE SET NULL;

-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: template_exercises template_exercises_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.template_exercises
    ADD CONSTRAINT template_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE SET NULL;

-- Name: template_exercises template_exercises_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.template_exercises
    ADD CONSTRAINT template_exercises_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;

-- Name: templates templates_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE;

-- Name: templates templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Name: trainer_applications trainer_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_applications
    ADD CONSTRAINT trainer_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: trainer_clients trainer_clients_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_clients
    ADD CONSTRAINT trainer_clients_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: trainer_clients trainer_clients_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_clients
    ADD CONSTRAINT trainer_clients_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: trainer_login_history trainer_login_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_login_history
    ADD CONSTRAINT trainer_login_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: trainer_sessions trainer_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.trainer_sessions
    ADD CONSTRAINT trainer_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: user_identities user_identities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: user_login_history user_login_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_login_history
    ADD CONSTRAINT user_login_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: user_metrics user_metrics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_metrics
    ADD CONSTRAINT user_metrics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
