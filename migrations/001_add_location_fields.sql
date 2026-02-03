-- Migration: Add location fields to events table and create worker_locations table
-- Description: Support GPS-based attendance with address, coordinates, and radius

-- Add location fields to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS location_address TEXT,
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_radius INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS qr_code VARCHAR(255);

-- Create worker_locations table for GPS tracking
CREATE TABLE IF NOT EXISTS worker_locations (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_worker_locations_worker_id ON worker_locations(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_locations_event_id ON worker_locations(event_id);
CREATE INDEX IF NOT EXISTS idx_worker_locations_created_at ON worker_locations(created_at);

-- Create attendance_approvals table for tracking approval status
CREATE TABLE IF NOT EXISTS attendance_approvals (
    id SERIAL PRIMARY KEY,
    attendance_id INTEGER NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    approval_type VARCHAR(20) NOT NULL CHECK (approval_type IN ('gps', 'qr')),
    distance_meters INTEGER,
    approved_by INTEGER REFERENCES admin_users(id),
    approved_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_approvals_status ON attendance_approvals(status);
CREATE INDEX IF NOT EXISTS idx_attendance_approvals_event_id ON attendance_approvals(event_id);
