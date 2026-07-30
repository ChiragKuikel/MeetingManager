-- MySQL schema inventory — captured 2026-07-30 (Phase 0 safety audit).
-- Source of truth for the Phase 1 Prisma schema. Dumped via `SHOW CREATE TABLE`
-- from local `meeting_summarizer` DB (MySQL 8.0). MySQL is being replaced by
-- Postgres in Phase 1 — this file is the frozen record of the pre-migration shape.
--
-- Phase 1 mapping notes (do NOT copy 1:1 — see migration-plan.md / CLAUDE.md):
--   * add `organizationId` to every top-level entity (User, Video) — multi-tenancy prep
--   * `json` columns → Postgres `jsonb`
--   * `enum` columns → Prisma enums
--   * processing_queue may be dropped entirely once BullMQ replaces it (Phase 3)

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `videos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` bigint DEFAULT NULL,
  `duration` int DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `status` enum('uploading','processing','completed','failed') DEFAULT 'uploading',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_status` (`user_id`,`status`),
  CONSTRAINT `videos_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `summaries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `video_id` int NOT NULL,
  `summary_text` text,
  `key_points` json DEFAULT NULL,
  `action_items` json DEFAULT NULL,
  `speakers` json DEFAULT NULL,
  `transcript` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `video_id` (`video_id`),
  CONSTRAINT `summaries_ibfk_1` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `processing_queue` (
  `id` int NOT NULL AUTO_INCREMENT,
  `video_id` int NOT NULL,
  `priority` int DEFAULT '0',
  `status` enum('queued','processing','completed','failed') DEFAULT 'queued',
  `attempts` int DEFAULT '0',
  `error_message` text,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `video_id` (`video_id`),
  KEY `idx_status_priority` (`status`,`priority`),
  CONSTRAINT `processing_queue_ibfk_1` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
