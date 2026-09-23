-- db/schema.sql
-- Student Repo Manager database schema
-- Run this once on a fresh Neon PostgreSQL database

CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  org_name VARCHAR(255) NOT NULL,
  installation_id BIGINT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_verified_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE repo_creation_links (
  id SERIAL PRIMARY KEY,
  link_id VARCHAR(255) NOT NULL UNIQUE,
  org_id INTEGER NOT NULL REFERENCES organizations(id),
  created_by_username VARCHAR(255) NOT NULL,
  link_type VARCHAR(50) NOT NULL,
  template_repo VARCHAR(255),
  assessment_name VARCHAR(255) NOT NULL,
  access_level VARCHAR(50) NOT NULL DEFAULT 'write',
  min_team_size INTEGER,
  max_team_size INTEGER,
  max_groups INTEGER,
  current_groups INTEGER DEFAULT 0,
  max_repos_created INTEGER,
  current_repos_created INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT unique_assessment_per_org
    UNIQUE (org_id, assessment_name)
);

CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  link_id INTEGER NOT NULL
    REFERENCES repo_creation_links(id) ON DELETE CASCADE,
  team_name VARCHAR(255) NOT NULL,
  github_team_id INTEGER,
  github_team_slug VARCHAR(255),
  repo_name VARCHAR(255),
  repo_url VARCHAR(255),
  expected_team_size INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT teams_link_name_unique
    UNIQUE (link_id, team_name)
);

CREATE TABLE student_repo_access (
  id SERIAL PRIMARY KEY,
  link_id INTEGER NOT NULL
    REFERENCES repo_creation_links(id) ON DELETE RESTRICT,
  github_id BIGINT NOT NULL,
  github_login VARCHAR(255),
  team_id INTEGER REFERENCES teams(id),
  repo_name VARCHAR(255) NOT NULL,
  repo_url VARCHAR(255) NOT NULL,
  access_level VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(link_id, github_id)
);
