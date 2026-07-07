--
-- PostgreSQL database dump
--

\restrict vL41roRgXeWpCgeaWDd30IR5k0WQvVF1Oy1FxQeDcLQsAvfpkXh993JXcL555Sd

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AgentAccountStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AgentAccountStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED'
);


--
-- Name: AgentOnlineStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AgentOnlineStatus" AS ENUM (
    'ONLINE',
    'OFFLINE',
    'BUSY',
    'AWAY'
);


--
-- Name: AgentRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AgentRole" AS ENUM (
    'AGENT',
    'SUPERVISOR',
    'TENANT_ADMIN'
);


--
-- Name: MessageSenderType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MessageSenderType" AS ENUM (
    'USER',
    'AGENT',
    'SYSTEM'
);


--
-- Name: MessageType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MessageType" AS ENUM (
    'TEXT',
    'IMAGE',
    'VIDEO',
    'FILE'
);


--
-- Name: SessionCloseReason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SessionCloseReason" AS ENUM (
    'MANUAL',
    'TIMEOUT',
    'DISCONNECT'
);


--
-- Name: SessionClosedBy; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SessionClosedBy" AS ENUM (
    'USER',
    'AGENT',
    'SYSTEM'
);


--
-- Name: SessionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SessionStatus" AS ENUM (
    'WAITING',
    'ACTIVE',
    'CLOSED'
);


--
-- Name: TenantStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TenantStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'DISABLED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents (
    id text NOT NULL,
    tenant_id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    role public."AgentRole" DEFAULT 'AGENT'::public."AgentRole" NOT NULL,
    status public."AgentOnlineStatus" DEFAULT 'OFFLINE'::public."AgentOnlineStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    account_status public."AgentAccountStatus" DEFAULT 'ACTIVE'::public."AgentAccountStatus" NOT NULL,
    phone text,
    remark text,
    agent_code text,
    avatar text
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id text NOT NULL,
    tenant_id text NOT NULL,
    user_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: login_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_logs (
    id text NOT NULL,
    account text NOT NULL,
    role text NOT NULL,
    tenant_code text,
    tenant_name text,
    ip text,
    user_agent text,
    success boolean DEFAULT true NOT NULL,
    fail_reason text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id text NOT NULL,
    tenant_id text NOT NULL,
    session_id text NOT NULL,
    sender_type public."MessageSenderType" NOT NULL,
    sender_id text,
    type public."MessageType" DEFAULT 'TEXT'::public."MessageType" NOT NULL,
    content text NOT NULL,
    metadata jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    read_at timestamp(3) without time zone
);


--
-- Name: operation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operation_logs (
    id text NOT NULL,
    admin_id text,
    admin_email text NOT NULL,
    action text NOT NULL,
    target text,
    detail text,
    ip text,
    user_agent text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: platform_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_admins (
    id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: quick_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quick_replies (
    id text NOT NULL,
    tenant_id text NOT NULL,
    agent_id text,
    title text NOT NULL,
    content text NOT NULL,
    shortcut text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: remarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.remarks (
    id text NOT NULL,
    tenant_id text NOT NULL,
    user_id text NOT NULL,
    agent_id text NOT NULL,
    content text NOT NULL,
    tags text[] DEFAULT ARRAY[]::text[],
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    tenant_id text NOT NULL,
    user_id text NOT NULL,
    agent_id text,
    status public."SessionStatus" DEFAULT 'WAITING'::public."SessionStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    closed_at timestamp(3) without time zone,
    preferred_agent_id text,
    closed_by public."SessionClosedBy",
    closed_reason public."SessionCloseReason",
    conversation_id text NOT NULL
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: tenant_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_settings (
    id text NOT NULL,
    tenant_id text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    api_key text NOT NULL,
    status public."TenantStatus" DEFAULT 'ACTIVE'::public."TenantStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    admin_email text NOT NULL,
    contact_name text,
    contact_phone text,
    domain text,
    remark text,
    tenant_code text NOT NULL
);


--
-- Name: transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transfers (
    id text NOT NULL,
    tenant_id text NOT NULL,
    session_id text NOT NULL,
    from_agent_id text NOT NULL,
    to_agent_id text NOT NULL,
    reason text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    tenant_id text NOT NULL,
    device_id text,
    nickname text,
    metadata jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    visitor_no integer,
    original_name text,
    first_seen_at timestamp(3) without time zone,
    last_seen_at timestamp(3) without time zone
);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
33738bbf-abd4-4ee7-a93f-f85cfce3d96b	add6f675106a1c6facd1c510f0ff697a62f926b097fee25ecf588cded0e96eee	2026-07-03 14:44:12.467092+00	20260703144412_init	\N	\N	2026-07-03 14:44:12.281014+00	1
19b2417d-4bbd-4e07-aad7-6395f8336c5a	f5366f096157499493a74ea1205b77ddb9df6326dda54059d970b2c3709aeb26	2026-07-03 15:01:23.582468+00	20260703150055_admin_enhancements	\N	\N	2026-07-03 15:01:23.531999+00	1
dba6f45b-8520-4738-bdff-c1e9c7e64091	20fcbf2fe2b5fcf2ceafa3bde0aeb36e968b15b9465eb15bde408cf0b0077e8e	2026-07-03 15:24:35.718683+00	20260703153000_add_tenant_code	\N	\N	2026-07-03 15:24:35.694801+00	1
2e17599b-de1e-463d-905c-e0adfd84e8cd	aafd0c189a23129eada55554168bf75df2ff8fa5e418e10cf9a2a885f6dc5e32	2026-07-03 15:45:30.30489+00	20260703160000_v2_tenant_settings_login_logs	\N	\N	2026-07-03 15:45:30.24256+00	1
ce424a0b-f28d-4507-96aa-d4ab004d6942	055123cca2c7335d5b2355b4efffbd34d9c988e92615ef1c4a6f3432cc4e2a2c	2026-07-03 16:02:18.85066+00	20260703170000_add_tenant_admin_role	\N	\N	2026-07-03 16:02:18.835521+00	1
c184914b-e4a7-40f4-a34e-7f2ecc8228af	7eed390f75efb6c991c21aed0f0443f95a413d636086f9ed3e588cf3bd4972a6	2026-07-03 16:26:31.968305+00	20260704010000_agent_v11_features	\N	\N	2026-07-03 16:26:31.915735+00	1
1b0d130d-18c7-4bfa-a358-909998a821ac	926a0531610458d9a8a742cf47bb88e3eb861ae28ac55f9b72f775b4a3703afe	2026-07-03 17:17:55.064532+00	20260704020000_session_close_metadata	\N	\N	2026-07-03 17:17:55.032867+00	1
f0be8583-1c00-4c88-ba45-52bbc47fadff	8b0775d6006a4b3d0b77b819525f054d3674e747f736d1b1f8b919f63d4bfd14	2026-07-03 17:34:04.62833+00	20260704030000_conversation_model	\N	\N	2026-07-03 17:34:04.512368+00	1
\.


--
-- Data for Name: agents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agents (id, tenant_id, email, password, name, role, status, created_at, updated_at, account_status, phone, remark, agent_code, avatar) FROM stdin;
208bc02d-dd49-4bcb-9cc2-dc24d7c0b452	085eaa5e-3a73-4f0c-8b97-57fa63bb2684	1002@qq.com	$2b$10$2gVT0MKb4vF80bWlgUWh6On7/OSRxHbJrVDI2d144ZS/6VTXA4mDe	测试联系人	SUPERVISOR	OFFLINE	2026-07-03 15:07:58.14	2026-07-03 16:00:25.195	ACTIVE	\N	\N	\N	\N
641532b5-4535-4618-9b40-beca281084a6	13217798-cc64-4216-b577-bc7500587dd0	123456@qq.com	$2b$10$/wgAyOQ6YEr1FOFWknaHDODzc.SqNsi9vIedyRzvIQD11M1EHBsEO	演示企业测试账号	AGENT	OFFLINE	2026-07-03 14:49:25.747	2026-07-03 14:49:25.747	ACTIVE	\N	\N	\N	\N
29f52abc-a4e4-48e3-83a7-c6f590888714	13217798-cc64-4216-b577-bc7500587dd0	lele	$2b$10$gWn1wfOYShKQKwh.Rio2ruQHIuMi9hr6MGurHN5OscDVRLMt3D/zC	乐乐	AGENT	OFFLINE	2026-07-03 16:17:23.935	2026-07-03 16:17:23.935	ACTIVE	\N	\N	\N	\N
29063cfe-ccdf-459f-9195-ae9036eff7a2	13217798-cc64-4216-b577-bc7500587dd0	admin@demo.com	$2b$10$HTe5xMCVHGOqGJ5XhhiURerSTmumDJc4/jjekgNr6KwbGtd0k1uoW	企业管理员	TENANT_ADMIN	OFFLINE	2026-07-03 16:03:41.364	2026-07-03 16:27:11.951	ACTIVE	13800138001	\N	AG001	\N
66284ac3-aa17-4cc4-9597-197c643b214a	13217798-cc64-4216-b577-bc7500587dd0	supervisor@demo.com	$2b$10$3SlhTwCMT8otkOkFo8caDup2Sp2p9TbQSmmfp.8t2JhzvIW4A6jRm	客服主管	SUPERVISOR	OFFLINE	2026-07-03 16:03:41.372	2026-07-03 16:27:11.959	ACTIVE	13800138002	\N	\N	\N
e028114e-d11f-413d-8c87-f3b1b3422239	13217798-cc64-4216-b577-bc7500587dd0	agent@demo.com	$2b$10$R1zWmCBHifOHctUOHXRR.uGoc.j.z2MLqE4uWwo2ChZzp.RTm2T/O	客服小王	AGENT	OFFLINE	2026-07-03 14:44:26.193	2026-07-03 17:47:11.761	ACTIVE	\N	\N	AG002	\N
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conversations (id, tenant_id, user_id, created_at, updated_at) FROM stdin;
d5c25cee-4b3f-492f-b3ea-66c1ab840a5a	13217798-cc64-4216-b577-bc7500587dd0	e4bc3fbb-21d7-43e0-9cb7-80934fcb0cd2	2026-07-03 17:41:02.334	2026-07-03 17:41:02.368
6643745b-2c2b-42e7-adca-a1eb0c2c1690	13217798-cc64-4216-b577-bc7500587dd0	d9f6f4da-5e71-4ae6-a00d-6da7fc98dd24	2026-07-03 17:41:16.79	2026-07-03 17:41:16.811
665733cb-ea58-4024-999f-95b360bd62cf	13217798-cc64-4216-b577-bc7500587dd0	4af3057a-b22c-43ed-9f2f-50a7cb542556	2026-07-03 14:46:40.074	2026-07-03 17:43:52.903
9ca1ef15-dfb5-45ac-afea-4a1ba49a296e	13217798-cc64-4216-b577-bc7500587dd0	a12b7a35-7559-46e1-acf5-5a47531ee340	2026-07-03 15:23:27.387	2026-07-03 17:47:44.251
\.


--
-- Data for Name: login_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.login_logs (id, account, role, tenant_code, tenant_name, ip, user_agent, success, fail_reason, created_at) FROM stdin;
bffc7b00-96d3-4fb7-989f-48db84e569f2	agent@demo.com	agent	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 15:48:58.141
5fba63eb-0b65-40f7-97a5-ddc5a457aa7f	admin@example.com	platform_admin	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 15:49:05.868
7fc23cd5-d44c-4e39-bc14-bf6f97f25a9c	1002@qq.com	agent	1002	测试企业1002	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 15:49:54.774
deebff6c-103f-4551-9690-cee0eab59879	1002@qq.com	platform_admin	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	f	Invalid credentials	2026-07-03 15:50:28.197
55d72e92-bf03-4689-9153-0c805bbd119d	1002@qq.com	platform_admin	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	f	Invalid credentials	2026-07-03 15:50:29.063
b00dfd27-7861-4d9d-ba1c-9202c99f1bc4	admin@example.com	platform_admin	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 15:50:37.623
c3baf75c-3a6f-4851-aaa3-8608d10760be	admin@example.com	PLATFORM_ADMIN	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 16:04:42.414
ba0ed08d-627f-44af-8392-5939084440bd	admin@example.com	PLATFORM_ADMIN	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 16:08:55.04
41301133-c198-4fa7-8354-eb2029635fde	admin@demo.com	TENANT_ADMIN	demo001	演示企业	::1	Mozilla/5.0 (Windows NT; Windows NT 10.0; zh-CN) WindowsPowerShell/5.1.26100.8655	t	\N	2026-07-03 16:10:24.721
e02e3220-2776-4ffa-b9a3-f7f2e1ec7596	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Cursor/3.8.11 Chrome/144.0.7559.236 Electron/40.10.3 Safari/537.36	t	\N	2026-07-03 16:10:44.091
3bc60df2-4ae7-4ced-8584-ecc1ecad6ace	admin@demo.com	TENANT_ADMIN	demo001	演示企业	::1	Mozilla/5.0 (Windows NT; Windows NT 10.0; zh-CN) WindowsPowerShell/5.1.26100.8655	t	\N	2026-07-03 16:11:07.479
c494f1a3-ee62-478d-a20c-b93cbcff8d10	admin@demo.com	TENANT_ADMIN	demo001	演示企业	::1	Mozilla/5.0 (Windows NT; Windows NT 10.0; zh-CN) WindowsPowerShell/5.1.26100.8655	t	\N	2026-07-03 16:11:33.627
12ffacf0-e8b9-40ef-ac86-6b0fcb5cee4c	admin@demo.com	TENANT_ADMIN	demo001	演示企业	::1	Mozilla/5.0 (Windows NT; Windows NT 10.0; zh-CN) WindowsPowerShell/5.1.26100.8655	t	\N	2026-07-03 16:12:07.892
196c67c8-0312-4830-a66d-46c071459e71	admin@demo.com	TENANT_ADMIN	demo001	演示企业	::1	Mozilla/5.0 (Windows NT; Windows NT 10.0; zh-CN) WindowsPowerShell/5.1.26100.8655	t	\N	2026-07-03 16:12:37.591
80e1e6ce-32aa-441b-998e-03a580c6b390	admin@demo.com	TENANT_ADMIN	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Cursor/3.8.11 Chrome/144.0.7559.236 Electron/40.10.3 Safari/537.36	t	\N	2026-07-03 16:13:42.104
c3941a6c-ae97-405c-80d7-1a35b3251d82	admin@demo.com	TENANT_ADMIN	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 16:13:55.128
df559a32-ea80-4c57-9b36-11e85150cb61	admin@example.com	PLATFORM_ADMIN	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 16:14:07.967
7be27c68-338f-41d3-a4dd-6a266d7f7732	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 16:15:22.882
241fcf3a-0f9d-445e-a429-4574aab7a75e	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 16:32:18.819
585e2cb5-d4d3-4c4b-959d-4a606757931c	admin@demo.com	TENANT_ADMIN	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 16:42:23.241
17be3d2c-4397-4eef-8f30-90a39263bf3f	admin@demo.com	TENANT_ADMIN	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 16:42:28.586
d7f14f66-f3ff-4391-befb-7c6efa3adb45	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 16:48:34.993
ec109591-6c97-4b81-ad2d-7d9921c30dfe	admin@demo.com	TENANT_ADMIN	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 16:51:44.932
c080f175-f972-4220-85b0-39039b113fb1	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 16:52:26.851
c3afaae2-d5ea-47a0-9427-5cb1b6904223	admin@example.com	PLATFORM_ADMIN	\N	\N	::1	Mozilla/5.0 (Windows NT; Windows NT 10.0; zh-CN) WindowsPowerShell/5.1.26100.8655	t	\N	2026-07-03 16:59:55.555
a8ac546f-e09f-42c6-a12c-10c306ef787e	admin@demo.com	TENANT_ADMIN	demo001	演示企业	::1	Mozilla/5.0 (Windows NT; Windows NT 10.0; zh-CN) WindowsPowerShell/5.1.26100.8655	t	\N	2026-07-03 16:59:55.752
854ba188-a00a-48ba-b870-c57564c95a6d	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT; Windows NT 10.0; zh-CN) WindowsPowerShell/5.1.26100.8655	t	\N	2026-07-03 16:59:55.822
145d9287-a618-486a-99d6-07f16b7270df	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:01:45.39
eb4a28f6-a9af-4b91-afe0-99e2db95a722	admin@demo.com	TENANT_ADMIN	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:03:39.663
fbf0728e-28e9-4f23-b522-d5624a8dc4f6	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:04:00.772
695b06a7-9ae0-4d79-b1b2-a6e31a731b51	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:05:34.429
77fb2a03-2ba7-4148-b18f-5f064de3bb08	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:07:49.871
24023f7c-6646-43a0-ac35-f12e5560b711	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:17:28.052
3329509e-c1b6-4830-a2b9-fbf0f3e1c728	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:22:54.516
4c8e0b45-4780-4f88-bad5-5517e8c91164	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:24:42.74
e18045d6-eed5-4e82-821f-e8768430080e	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:25:09.747
92519df3-90ff-4e62-974a-6e23c3ad5aee	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:25:17.658
8a452246-a842-4bb2-a0c7-895d7001a9d9	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:26:07.011
35fd27ed-62b4-4113-891a-db93dbb830d3	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:32:09.902
7954f7c4-2b6c-4699-9d3a-c41380067c6e	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:35:54.712
634cd2eb-3fa4-4941-9ad8-dd9a9a5744d0	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:43:29.891
2459c1bc-7c21-49c0-9502-12a42bed47a3	agent@demo.com	AGENT	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:43:57.734
4aa656e0-65ce-4813-ab20-d00cf8349f9d	admin@demo.com	TENANT_ADMIN	demo001	演示企业	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	t	\N	2026-07-03 17:47:00.865
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.messages (id, tenant_id, session_id, sender_type, sender_id, type, content, metadata, created_at, read_at) FROM stdin;
3ef409e6-204f-4867-a3c6-732ec54758be	13217798-cc64-4216-b577-bc7500587dd0	0721747c-cc6d-4421-9b37-86b9b037a3b6	AGENT	e028114e-d11f-413d-8c87-f3b1b3422239	TEXT	您好，很高兴为您服务，请问有什么可以帮您？	\N	2026-07-03 14:46:50.382	\N
434a4f8c-c712-4500-a19d-1e4895232463	13217798-cc64-4216-b577-bc7500587dd0	0721747c-cc6d-4421-9b37-86b9b037a3b6	AGENT	e028114e-d11f-413d-8c87-f3b1b3422239	FILE	http://localhost:3000/uploads/13217798-cc64-4216-b577-bc7500587dd0/2026/07/42f5cc01-e8df-4024-80c5-568514745f18.md	\N	2026-07-03 14:47:09.948	\N
98734e55-ba15-4d52-a4bb-9d46e99398f3	13217798-cc64-4216-b577-bc7500587dd0	0721747c-cc6d-4421-9b37-86b9b037a3b6	USER	4af3057a-b22c-43ed-9f2f-50a7cb542556	IMAGE	http://localhost:3000/uploads/13217798-cc64-4216-b577-bc7500587dd0/2026/07/a5ae4e3c-3092-4daa-9f9d-59a2c3e6a6c6.jpg	\N	2026-07-03 14:48:32.095	\N
57a1314c-9d78-4030-b6bc-82b0074ddd1e	13217798-cc64-4216-b577-bc7500587dd0	0721747c-cc6d-4421-9b37-86b9b037a3b6	AGENT	e028114e-d11f-413d-8c87-f3b1b3422239	TEXT	请稍等，我正在为您查询。	\N	2026-07-03 14:50:35.139	\N
fa001cee-0830-4d72-98c3-05a389f9f990	13217798-cc64-4216-b577-bc7500587dd0	0721747c-cc6d-4421-9b37-86b9b037a3b6	AGENT	e028114e-d11f-413d-8c87-f3b1b3422239	TEXT	de da ddsa	\N	2026-07-03 14:51:02.493	\N
7e7729fa-94e7-4cf9-8bf5-094f4a856bc2	13217798-cc64-4216-b577-bc7500587dd0	f2528bff-bf0f-4c7e-a011-18832a81f420	USER	a12b7a35-7559-46e1-acf5-5a47531ee340	TEXT	你好	\N	2026-07-03 15:31:43.452	\N
3aca3598-f75c-4c40-8c60-e4d1f4e91631	13217798-cc64-4216-b577-bc7500587dd0	f2528bff-bf0f-4c7e-a011-18832a81f420	USER	a12b7a35-7559-46e1-acf5-5a47531ee340	TEXT	打法	\N	2026-07-03 15:31:49.385	\N
3fd20cd9-d20a-4c2f-8373-978f790a3592	13217798-cc64-4216-b577-bc7500587dd0	0721747c-cc6d-4421-9b37-86b9b037a3b6	USER	4af3057a-b22c-43ed-9f2f-50a7cb542556	IMAGE	http://localhost:3000/uploads/13217798-cc64-4216-b577-bc7500587dd0/2026/07/85aa8884-955e-4fb3-af5b-4e33b9a148ce.png	\N	2026-07-03 16:35:41.279	\N
00852692-dd77-41f0-ae38-9ae0d0a37250	13217798-cc64-4216-b577-bc7500587dd0	0721747c-cc6d-4421-9b37-86b9b037a3b6	AGENT	e028114e-d11f-413d-8c87-f3b1b3422239	FILE	http://localhost:3000/uploads/13217798-cc64-4216-b577-bc7500587dd0/2026/07/33368c46-a311-45a2-b42a-604f8b917772.zip	\N	2026-07-03 16:35:58.256	\N
4831f493-a2eb-47db-983d-0ec9640ae131	13217798-cc64-4216-b577-bc7500587dd0	f2528bff-bf0f-4c7e-a011-18832a81f420	SYSTEM	\N	TEXT	本次会话已结束。	\N	2026-07-03 17:21:56.204	\N
d9fa77b8-76c1-4e96-886b-a191bd477af3	13217798-cc64-4216-b577-bc7500587dd0	0721747c-cc6d-4421-9b37-86b9b037a3b6	SYSTEM	\N	TEXT	本次会话已结束。	\N	2026-07-03 17:21:56.366	\N
e5b46816-7e87-42bd-af9b-d3d7b7946ec7	13217798-cc64-4216-b577-bc7500587dd0	2bcd3d2c-2436-4aba-925e-83bd83075214	USER	4af3057a-b22c-43ed-9f2f-50a7cb542556	TEXT	单独	\N	2026-07-03 17:25:32.848	\N
837c26a2-b7a3-4a15-a714-dadd48645d76	13217798-cc64-4216-b577-bc7500587dd0	2bcd3d2c-2436-4aba-925e-83bd83075214	USER	4af3057a-b22c-43ed-9f2f-50a7cb542556	TEXT	的撒发生d	\N	2026-07-03 17:25:48.389	\N
d69fd16a-6974-4af1-95f7-f0c8a2ddf7a6	13217798-cc64-4216-b577-bc7500587dd0	2bcd3d2c-2436-4aba-925e-83bd83075214	USER	4af3057a-b22c-43ed-9f2f-50a7cb542556	TEXT	第三发	\N	2026-07-03 17:26:01.828	\N
c9aef9d8-0ca0-44f5-99e5-803115ce11d8	13217798-cc64-4216-b577-bc7500587dd0	412d8b8a-36be-4477-90ab-100ba3fe545b	SYSTEM	\N	TEXT	本次会话已结束。	\N	2026-07-03 17:30:25.531	\N
ea526e22-68ad-40ba-9dc9-00ed839c73cd	13217798-cc64-4216-b577-bc7500587dd0	3f3c02b7-3ea4-4b96-9967-75febb2c0c91	USER	a12b7a35-7559-46e1-acf5-5a47531ee340	TEXT	111	\N	2026-07-03 17:30:30.935	\N
5a85805b-7333-42ed-927e-59e2d822d545	13217798-cc64-4216-b577-bc7500587dd0	3f3c02b7-3ea4-4b96-9967-75febb2c0c91	SYSTEM	\N	TEXT	本次会话已结束。	\N	2026-07-03 17:32:16.185	\N
0bcafe3f-099e-4dc1-8d15-4082207f9cfb	13217798-cc64-4216-b577-bc7500587dd0	5dc87395-2316-43df-a12f-4f747561e086	AGENT	e028114e-d11f-413d-8c87-f3b1b3422239	TEXT	11	\N	2026-07-03 17:36:44.606	\N
27ce4feb-bbd5-477d-b6be-9b30f274055c	13217798-cc64-4216-b577-bc7500587dd0	5dc87395-2316-43df-a12f-4f747561e086	AGENT	e028114e-d11f-413d-8c87-f3b1b3422239	TEXT	111	\N	2026-07-03 17:36:47.926	\N
85136c70-3a5b-409b-b5f7-ad3db7e1bfcf	13217798-cc64-4216-b577-bc7500587dd0	2bcd3d2c-2436-4aba-925e-83bd83075214	AGENT	e028114e-d11f-413d-8c87-f3b1b3422239	FILE	http://localhost:3000/uploads/13217798-cc64-4216-b577-bc7500587dd0/2026/07/b6f1f839-b52f-4eb6-afe2-9f8f4a3aeb22.zip	\N	2026-07-03 17:37:08.074	\N
edd87d5d-913d-4037-b768-5ee1e3f54001	13217798-cc64-4216-b577-bc7500587dd0	2bcd3d2c-2436-4aba-925e-83bd83075214	AGENT	e028114e-d11f-413d-8c87-f3b1b3422239	IMAGE	http://localhost:3000/uploads/13217798-cc64-4216-b577-bc7500587dd0/2026/07/1cbfe287-3a60-48de-8986-b6c408c5c93d.png	\N	2026-07-03 17:37:36.855	\N
b871aac4-4812-4381-96c4-8e3617ec8d39	13217798-cc64-4216-b577-bc7500587dd0	2bcd3d2c-2436-4aba-925e-83bd83075214	USER	4af3057a-b22c-43ed-9f2f-50a7cb542556	IMAGE	http://localhost:3000/uploads/13217798-cc64-4216-b577-bc7500587dd0/2026/07/0576030f-2898-4bfc-8993-f789af71e4c1.png	\N	2026-07-03 17:38:35.227	\N
528b0e3b-b5ef-43be-8239-b554bac05762	13217798-cc64-4216-b577-bc7500587dd0	2bcd3d2c-2436-4aba-925e-83bd83075214	USER	4af3057a-b22c-43ed-9f2f-50a7cb542556	TEXT	而我是的人发生的	\N	2026-07-03 17:38:52.972	\N
5e4dab62-561c-4b8e-998b-4f5df83756af	13217798-cc64-4216-b577-bc7500587dd0	2bcd3d2c-2436-4aba-925e-83bd83075214	USER	4af3057a-b22c-43ed-9f2f-50a7cb542556	TEXT	大法师	\N	2026-07-03 17:38:54.294	\N
5baede7b-795f-4de3-98af-4399f48a357a	13217798-cc64-4216-b577-bc7500587dd0	5dc87395-2316-43df-a12f-4f747561e086	USER	a12b7a35-7559-46e1-acf5-5a47531ee340	TEXT	大师傅d	\N	2026-07-03 17:39:06.729	\N
aa97041e-9509-40cb-80ff-a9917525ee76	13217798-cc64-4216-b577-bc7500587dd0	e3b56910-715e-4ca2-94c6-90d911cfe151	USER	4af3057a-b22c-43ed-9f2f-50a7cb542556	TEXT	45	\N	2026-07-03 17:40:49.1	\N
d0de1fa0-9e49-47b0-9089-9088c51ecad8	13217798-cc64-4216-b577-bc7500587dd0	e3b56910-715e-4ca2-94c6-90d911cfe151	USER	4af3057a-b22c-43ed-9f2f-50a7cb542556	TEXT	广泛大概、	\N	2026-07-03 17:40:56.307	\N
8b192c37-a471-4f61-be16-06ac79c9be0d	13217798-cc64-4216-b577-bc7500587dd0	5dc87395-2316-43df-a12f-4f747561e086	USER	a12b7a35-7559-46e1-acf5-5a47531ee340	IMAGE	http://localhost:3000/uploads/13217798-cc64-4216-b577-bc7500587dd0/2026/07/e0cf7838-6a5e-4b36-b292-f5a7dcb3dab4.png	\N	2026-07-03 17:42:22.802	\N
1ce98ca5-e13c-4566-964f-e93d0eac4eea	13217798-cc64-4216-b577-bc7500587dd0	e3b56910-715e-4ca2-94c6-90d911cfe151	USER	4af3057a-b22c-43ed-9f2f-50a7cb542556	TEXT	111；	\N	2026-07-03 17:43:52.892	\N
18a80a67-5567-4a28-83f4-94a1c0960cc6	13217798-cc64-4216-b577-bc7500587dd0	5dc87395-2316-43df-a12f-4f747561e086	USER	a12b7a35-7559-46e1-acf5-5a47531ee340	IMAGE	http://localhost:3000/uploads/13217798-cc64-4216-b577-bc7500587dd0/2026/07/d9860092-ffe1-43c8-82ea-f91dd99fd989.jpg	\N	2026-07-03 17:47:44.236	\N
\.


--
-- Data for Name: operation_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.operation_logs (id, admin_id, admin_email, action, target, detail, ip, user_agent, created_at) FROM stdin;
7f4ca810-c7b6-40f5-94c9-a7a0968df18e	cc49531b-18c8-4a95-b2fe-fb703979233b	admin@example.com	删除租户		\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	2026-07-03 15:04:18.139
78eb3677-5997-409b-a38a-9c951d3d9b2d	cc49531b-18c8-4a95-b2fe-fb703979233b	admin@example.com	新增租户	测试企业1002	slug=1002	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	2026-07-03 15:07:58.148
2236c42b-13c1-4e1f-aca1-c1efbff9ef61	cc49531b-18c8-4a95-b2fe-fb703979233b	admin@example.com	编辑客服	测试联系人	{"accountStatus":"SUSPENDED"}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	2026-07-03 15:13:02.156
30d8d60d-5e43-4526-91e3-1931e961f89a	cc49531b-18c8-4a95-b2fe-fb703979233b	admin@example.com	编辑客服	测试联系人	{"accountStatus":"ACTIVE"}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	2026-07-03 15:13:05.151
f8c2d4ce-f88d-4916-9f20-09bfece97bd3	cc49531b-18c8-4a95-b2fe-fb703979233b	admin@example.com	删除企业常用语	欢迎语	tenantCode=demo001	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	2026-07-03 15:36:15.604
9f75718e-d0d7-48b9-897f-74fe21385765	cc49531b-18c8-4a95-b2fe-fb703979233b	admin@example.com	删除企业常用语	欢迎语	tenantCode=demo001	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	2026-07-03 15:36:17.327
\.


--
-- Data for Name: platform_admins; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.platform_admins (id, email, password, name, created_at, updated_at) FROM stdin;
cc49531b-18c8-4a95-b2fe-fb703979233b	admin@example.com	$2b$10$mQpfMFZcgnbtg3v3rq.kuut0AwcRaHstZpCgQcDH4WFdMGzubrCT2	系统管理员	2026-07-03 14:44:26.095	2026-07-03 14:44:26.095
\.


--
-- Data for Name: quick_replies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quick_replies (id, tenant_id, agent_id, title, content, shortcut, created_at, updated_at) FROM stdin;
a59ebd8e-fcdd-4221-99b5-79dba64e2328	13217798-cc64-4216-b577-bc7500587dd0	\N	欢迎语	您好，很高兴为您服务，请问有什么可以帮您？	/welcome	2026-07-03 14:44:26.205	2026-07-03 14:44:26.205
e7cea9a1-83b7-43e9-b0bd-c1c485425e42	13217798-cc64-4216-b577-bc7500587dd0	e028114e-d11f-413d-8c87-f3b1b3422239	稍等	请稍等，我正在为您查询。	/wait	2026-07-03 14:44:26.205	2026-07-03 14:44:26.205
\.


--
-- Data for Name: remarks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.remarks (id, tenant_id, user_id, agent_id, content, tags, created_at, updated_at) FROM stdin;
9e379159-ef06-4186-833a-394c471ad55a	13217798-cc64-4216-b577-bc7500587dd0	4af3057a-b22c-43ed-9f2f-50a7cb542556	e028114e-d11f-413d-8c87-f3b1b3422239		{}	2026-07-03 16:32:33.966	2026-07-03 16:32:33.966
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, tenant_id, user_id, agent_id, status, created_at, updated_at, closed_at, preferred_agent_id, closed_by, closed_reason, conversation_id) FROM stdin;
2673e11a-2118-4825-85a8-dcaaaf423e01	13217798-cc64-4216-b577-bc7500587dd0	d9f6f4da-5e71-4ae6-a00d-6da7fc98dd24	e028114e-d11f-413d-8c87-f3b1b3422239	ACTIVE	2026-07-03 17:41:16.804	2026-07-03 17:43:33.147	\N	\N	\N	\N	6643745b-2c2b-42e7-adca-a1eb0c2c1690
2808d545-23d0-4f7e-a6af-3106d45578e6	13217798-cc64-4216-b577-bc7500587dd0	e4bc3fbb-21d7-43e0-9cb7-80934fcb0cd2	e028114e-d11f-413d-8c87-f3b1b3422239	ACTIVE	2026-07-03 17:41:02.361	2026-07-03 17:43:33.831	\N	\N	\N	\N	d5c25cee-4b3f-492f-b3ea-66c1ab840a5a
e3b56910-715e-4ca2-94c6-90d911cfe151	13217798-cc64-4216-b577-bc7500587dd0	4af3057a-b22c-43ed-9f2f-50a7cb542556	e028114e-d11f-413d-8c87-f3b1b3422239	ACTIVE	2026-07-03 17:40:49.087	2026-07-03 17:43:52.898	\N	\N	\N	\N	665733cb-ea58-4024-999f-95b360bd62cf
5dc87395-2316-43df-a12f-4f747561e086	13217798-cc64-4216-b577-bc7500587dd0	a12b7a35-7559-46e1-acf5-5a47531ee340	e028114e-d11f-413d-8c87-f3b1b3422239	ACTIVE	2026-07-03 17:32:48.712	2026-07-03 17:47:44.245	\N	e028114e-d11f-413d-8c87-f3b1b3422239	\N	\N	9ca1ef15-dfb5-45ac-afea-4a1ba49a296e
2bcd3d2c-2436-4aba-925e-83bd83075214	13217798-cc64-4216-b577-bc7500587dd0	4af3057a-b22c-43ed-9f2f-50a7cb542556	e028114e-d11f-413d-8c87-f3b1b3422239	CLOSED	2026-07-03 17:25:28.254	2026-07-03 17:40:44.292	2026-07-03 17:40:44.29	e028114e-d11f-413d-8c87-f3b1b3422239	USER	MANUAL	665733cb-ea58-4024-999f-95b360bd62cf
0721747c-cc6d-4421-9b37-86b9b037a3b6	13217798-cc64-4216-b577-bc7500587dd0	4af3057a-b22c-43ed-9f2f-50a7cb542556	e028114e-d11f-413d-8c87-f3b1b3422239	CLOSED	2026-07-03 14:46:40.074	2026-07-03 17:21:56.366	2026-07-03 17:21:56.363	\N	SYSTEM	TIMEOUT	665733cb-ea58-4024-999f-95b360bd62cf
f2528bff-bf0f-4c7e-a011-18832a81f420	13217798-cc64-4216-b577-bc7500587dd0	a12b7a35-7559-46e1-acf5-5a47531ee340	e028114e-d11f-413d-8c87-f3b1b3422239	CLOSED	2026-07-03 15:23:27.387	2026-07-03 17:21:56.204	2026-07-03 17:21:56.197	\N	SYSTEM	TIMEOUT	9ca1ef15-dfb5-45ac-afea-4a1ba49a296e
412d8b8a-36be-4477-90ab-100ba3fe545b	13217798-cc64-4216-b577-bc7500587dd0	a12b7a35-7559-46e1-acf5-5a47531ee340	e028114e-d11f-413d-8c87-f3b1b3422239	CLOSED	2026-07-03 17:30:23.38	2026-07-03 17:30:25.531	2026-07-03 17:30:25.527	e028114e-d11f-413d-8c87-f3b1b3422239	USER	MANUAL	9ca1ef15-dfb5-45ac-afea-4a1ba49a296e
3f3c02b7-3ea4-4b96-9967-75febb2c0c91	13217798-cc64-4216-b577-bc7500587dd0	a12b7a35-7559-46e1-acf5-5a47531ee340	e028114e-d11f-413d-8c87-f3b1b3422239	CLOSED	2026-07-03 17:30:28.569	2026-07-03 17:32:16.185	2026-07-03 17:32:16.18	e028114e-d11f-413d-8c87-f3b1b3422239	AGENT	MANUAL	9ca1ef15-dfb5-45ac-afea-4a1ba49a296e
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_settings (id, key, value, updated_at) FROM stdin;
7045da2a-2f67-4511-a778-e18e0aea5bda	siteName	企业级 SaaS 客服系统	2026-07-03 15:01:41.247
834f7801-9f0c-48f4-9aa2-36d47898765f	sdkBaseUrl	http://localhost:5176	2026-07-03 15:01:41.247
80875c85-7fd2-4ca5-9f30-46deee0029b5	supportEmail	support@example.com	2026-07-03 15:01:41.247
\.


--
-- Data for Name: tenant_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tenant_settings (id, tenant_id, key, value, updated_at) FROM stdin;
31de07b6-c37b-41b9-bf10-e29c056efea4	13217798-cc64-4216-b577-bc7500587dd0	welcomeMessage	您好，欢迎咨询，请问有什么可以帮您？	2026-07-03 16:52:18.594
71424c44-0c27-4dfb-be6a-9e2434846072	13217798-cc64-4216-b577-bc7500587dd0	chatColor	#4338ca	2026-07-03 16:52:18.608
873e2e23-9b57-4323-85d8-ab6704b532f6	13217798-cc64-4216-b577-bc7500587dd0	maxFileSizeMb	10	2026-07-03 16:52:18.612
f9cd0712-cf04-4c40-9d9e-eedbe8dfc891	13217798-cc64-4216-b577-bc7500587dd0	allowedFileTypes	image/*,video/*,.pdf,.doc,.docx	2026-07-03 16:52:18.616
25b93eaf-917d-487b-b11d-347c3b93b807	13217798-cc64-4216-b577-bc7500587dd0	sessionTimeoutMinutes	30	2026-07-03 16:52:18.621
75a6da06-45ff-495f-b5c8-604078a8d581	13217798-cc64-4216-b577-bc7500587dd0	assignmentStrategy	idle_first	2026-07-03 16:52:18.625
0094ce0f-4b47-4176-93d0-066adae9a1a5	13217798-cc64-4216-b577-bc7500587dd0	visitorTags	VIP,已成交,高意向	2026-07-03 16:52:18.629
c89eca2a-8640-49cd-8310-5208b9f5c4d3	13217798-cc64-4216-b577-bc7500587dd0	agentLinkOfflineBehavior	wait	2026-07-03 16:52:18.632
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tenants (id, name, slug, api_key, status, created_at, updated_at, admin_email, contact_name, contact_phone, domain, remark, tenant_code) FROM stdin;
085eaa5e-3a73-4f0c-8b97-57fa63bb2684	测试企业1002	1002	cs_ddde6884504b968256f93e100612c253e7e8756700197c24	ACTIVE	2026-07-03 15:07:58.13	2026-07-03 15:07:58.13	1002@qq.com	测试联系人	18738196888	\N	\N	1002
13217798-cc64-4216-b577-bc7500587dd0	演示企业	demo	cs_demo_api_key_12345	ACTIVE	2026-07-03 14:44:26.116	2026-07-03 16:27:11.819	agent@demo.com	\N	\N	\N	\N	demo001
\.


--
-- Data for Name: transfers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transfers (id, tenant_id, session_id, from_agent_id, to_agent_id, reason, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, tenant_id, device_id, nickname, metadata, created_at, updated_at, visitor_no, original_name, first_seen_at, last_seen_at) FROM stdin;
6fd34d63-7c99-42a8-9e45-2f70edac6ca8	13217798-cc64-4216-b577-bc7500587dd0	anon_1783089909984	访客000001	\N	2026-07-03 14:45:09.987	2026-07-03 16:27:11.987	1	访客000001	2026-07-03 14:45:09.987	2026-07-03 16:27:11.985
28bad8f7-2974-44ee-97c7-9b265d4ac7e9	13217798-cc64-4216-b577-bc7500587dd0	verify_device_001	访客000004	\N	2026-07-03 15:30:49.924	2026-07-03 16:27:12.01	4	访客000004	2026-07-03 15:30:49.924	2026-07-03 16:27:12.009
e4bc3fbb-21d7-43e0-9cb7-80934fcb0cd2	13217798-cc64-4216-b577-bc7500587dd0	test_debug_001	访客000005	{}	2026-07-03 17:41:02.185	2026-07-03 17:41:02.185	5	访客000005	2026-07-03 17:41:02.18	2026-07-03 17:41:02.18
d9f6f4da-5e71-4ae6-a00d-6da7fc98dd24	13217798-cc64-4216-b577-bc7500587dd0	test_debug_002	访客000006	{}	2026-07-03 17:41:16.752	2026-07-03 17:41:16.752	6	访客000006	2026-07-03 17:41:16.748	2026-07-03 17:41:16.748
4af3057a-b22c-43ed-9f2f-50a7cb542556	13217798-cc64-4216-b577-bc7500587dd0	device_0214fd20-9e56-4861-a74c-f3888ba5507c	访客000002	{"source": "在线客服 - 用户端", "pageUrl": "http://localhost:5173/?tenant=demo001&agent=AG002", "referer": "http://localhost:5173/?tenant=demo001&agent=AG002"}	2026-07-03 14:46:40.045	2026-07-03 17:43:55.388	2	访客000002	2026-07-03 14:46:40.045	2026-07-03 17:43:55.382
a12b7a35-7559-46e1-acf5-5a47531ee340	13217798-cc64-4216-b577-bc7500587dd0	device_a9cbb951-78e8-4ad5-afd9-9588045ad099	访客000003	{"source": "在线客服 - 用户端", "pageUrl": "http://localhost:5173/?tenant=demo001&agent=AG002", "referer": "http://localhost:5173/?tenant=demo001&agent=AG002"}	2026-07-03 15:23:27.284	2026-07-03 17:43:54.975	3	访客000003	2026-07-03 15:23:27.284	2026-07-03 17:43:54.971
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: login_logs login_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_logs
    ADD CONSTRAINT login_logs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: operation_logs operation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_logs
    ADD CONSTRAINT operation_logs_pkey PRIMARY KEY (id);


--
-- Name: platform_admins platform_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admins
    ADD CONSTRAINT platform_admins_pkey PRIMARY KEY (id);


--
-- Name: quick_replies quick_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_replies
    ADD CONSTRAINT quick_replies_pkey PRIMARY KEY (id);


--
-- Name: remarks remarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remarks
    ADD CONSTRAINT remarks_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: tenant_settings tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: transfers transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfers
    ADD CONSTRAINT transfers_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: agents_tenant_id_agent_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX agents_tenant_id_agent_code_key ON public.agents USING btree (tenant_id, agent_code);


--
-- Name: agents_tenant_id_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX agents_tenant_id_email_key ON public.agents USING btree (tenant_id, email);


--
-- Name: agents_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agents_tenant_id_idx ON public.agents USING btree (tenant_id);


--
-- Name: conversations_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_tenant_id_idx ON public.conversations USING btree (tenant_id);


--
-- Name: conversations_tenant_id_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conversations_tenant_id_user_id_key ON public.conversations USING btree (tenant_id, user_id);


--
-- Name: login_logs_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_logs_account_idx ON public.login_logs USING btree (account);


--
-- Name: login_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_logs_created_at_idx ON public.login_logs USING btree (created_at);


--
-- Name: messages_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_tenant_id_idx ON public.messages USING btree (tenant_id);


--
-- Name: messages_tenant_id_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_tenant_id_session_id_idx ON public.messages USING btree (tenant_id, session_id);


--
-- Name: operation_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX operation_logs_created_at_idx ON public.operation_logs USING btree (created_at);


--
-- Name: platform_admins_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX platform_admins_email_key ON public.platform_admins USING btree (email);


--
-- Name: quick_replies_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quick_replies_tenant_id_idx ON public.quick_replies USING btree (tenant_id);


--
-- Name: remarks_tenant_id_user_id_agent_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX remarks_tenant_id_user_id_agent_id_key ON public.remarks USING btree (tenant_id, user_id, agent_id);


--
-- Name: remarks_tenant_id_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX remarks_tenant_id_user_id_idx ON public.remarks USING btree (tenant_id, user_id);


--
-- Name: sessions_tenant_id_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_tenant_id_conversation_id_idx ON public.sessions USING btree (tenant_id, conversation_id);


--
-- Name: sessions_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_tenant_id_idx ON public.sessions USING btree (tenant_id);


--
-- Name: sessions_tenant_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_tenant_id_status_idx ON public.sessions USING btree (tenant_id, status);


--
-- Name: sessions_tenant_id_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_tenant_id_user_id_idx ON public.sessions USING btree (tenant_id, user_id);


--
-- Name: system_settings_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX system_settings_key_key ON public.system_settings USING btree (key);


--
-- Name: tenant_settings_tenant_id_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenant_settings_tenant_id_key_key ON public.tenant_settings USING btree (tenant_id, key);


--
-- Name: tenants_api_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenants_api_key_key ON public.tenants USING btree (api_key);


--
-- Name: tenants_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenants_slug_key ON public.tenants USING btree (slug);


--
-- Name: tenants_tenant_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenants_tenant_code_key ON public.tenants USING btree (tenant_code);


--
-- Name: transfers_tenant_id_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transfers_tenant_id_session_id_idx ON public.transfers USING btree (tenant_id, session_id);


--
-- Name: users_tenant_id_device_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_tenant_id_device_id_key ON public.users USING btree (tenant_id, device_id);


--
-- Name: users_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_tenant_id_idx ON public.users USING btree (tenant_id);


--
-- Name: users_tenant_id_visitor_no_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_tenant_id_visitor_no_key ON public.users USING btree (tenant_id, visitor_no);


--
-- Name: agents agents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: conversations conversations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: messages messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: messages messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: quick_replies quick_replies_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_replies
    ADD CONSTRAINT quick_replies_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: quick_replies quick_replies_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_replies
    ADD CONSTRAINT quick_replies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: remarks remarks_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remarks
    ADD CONSTRAINT remarks_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: remarks remarks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remarks
    ADD CONSTRAINT remarks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: remarks remarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remarks
    ADD CONSTRAINT remarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sessions sessions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sessions sessions_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sessions sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tenant_settings tenant_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: transfers transfers_from_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfers
    ADD CONSTRAINT transfers_from_agent_id_fkey FOREIGN KEY (from_agent_id) REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: transfers transfers_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfers
    ADD CONSTRAINT transfers_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: transfers transfers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfers
    ADD CONSTRAINT transfers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: transfers transfers_to_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfers
    ADD CONSTRAINT transfers_to_agent_id_fkey FOREIGN KEY (to_agent_id) REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict vL41roRgXeWpCgeaWDd30IR5k0WQvVF1Oy1FxQeDcLQsAvfpkXh993JXcL555Sd

