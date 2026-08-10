-- Migration: 001_create_whiteboard_workspaces.sql
-- Creates the persistent storage table for claimed (non-temporary) workspaces.
-- Temporary workspaces live in Redis with TTL and never touch this table.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS whiteboard_workspaces (
    id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(255) NOT NULL,

    -- NULL = unclaimed (should not exist in Postgres, handled by Redis)
    -- UUID = core/workspace/backend user UUID from JWT sub claim
    owner_id            UUID         NOT NULL,

    is_temporary        BOOLEAN      NOT NULL DEFAULT FALSE,

    -- Optional link to core/workspace/backend Workspace entity.
    -- Enables team-level access control via the organizational workspace.
    linked_workspace_id UUID         NULL,

    -- JSON array of user/session UUIDs
    collaborators       JSONB        NOT NULL DEFAULT '[]',

    -- Full Excalidraw scene: { elements: [...], appState: {...} }
    scene_state         JSONB        NOT NULL DEFAULT '{"elements":[],"appState":{}}',

    -- Monotonically incrementing for optimistic concurrency control
    version             INTEGER      NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Fast lookup by owner for "My Whiteboards" queries
CREATE INDEX IF NOT EXISTS idx_whiteboard_workspaces_owner
    ON whiteboard_workspaces (owner_id);

-- Fast lookup by linked workspace for team boards
CREATE INDEX IF NOT EXISTS idx_whiteboard_workspaces_linked
    ON whiteboard_workspaces (linked_workspace_id)
    WHERE linked_workspace_id IS NOT NULL;

-- GIN index for scene_state JSONB queries (future: element search)
CREATE INDEX IF NOT EXISTS idx_whiteboard_workspaces_scene_gin
    ON whiteboard_workspaces USING GIN (scene_state);

COMMENT ON TABLE whiteboard_workspaces IS
    'Persistent whiteboard workspaces claimed by authenticated users. '
    'Temporary guest workspaces are stored in Redis with TTL and never appear here.';
