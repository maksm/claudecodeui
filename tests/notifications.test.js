// Notification settings routes and database tests
import request from 'supertest';
import express from 'express';
import { initializeDatabase, db, userDb } from '../server/database/db.js';
import settingsRoutes from '../server/routes/settings.js';
import { notificationSettingsDb } from '../server/database/db.js';

// Mock auth middleware
const mockAuthMiddleware = (req, res, next) => {
  req.user = { id: 1, username: 'testuser' };
  next();
};

describe('Notification Settings', () => {
  let app;
  let testUser;
  let testUser2;

  beforeAll(async () => {
    // Initialize database with schema (using :memory: from test environment)
    await initializeDatabase();

    // Create a test user for foreign key constraints
    const hashedPassword = 'test-password-hash';
    testUser = userDb.createUser('testuser', hashedPassword);
    console.log('Created test user:', testUser);

    // Create a second test user for multi-user tests
    testUser2 = userDb.createUser('testuser2', hashedPassword);
    console.log('Created second test user:', testUser2);

    // Verify users were created
    const user = userDb.getUserById(testUser.id);
    const user2 = userDb.getUserById(testUser2.id);
    if (!user || !user2) {
      throw new Error('Failed to create test users');
    }
  });

  afterAll(async () => {
    // Close database connection to allow Jest to exit gracefully
    if (db && typeof db.close === 'function') {
      try {
        db.close();
        // Small delay to ensure cleanup completes
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Database might already be closed, ignore error
        console.log('Database cleanup:', error.message);
      }
    }
  });

  beforeEach(() => {
    // Create Express app with settings routes
    app = express();
    app.use(express.json());
    // Use the actual user ID from the created test user
    app.use((req, res, next) => {
      req.user = { id: testUser.id, username: 'testuser' };
      next();
    });
    app.use('/api/settings', settingsRoutes);

    // Clear notification_settings before each test
    db.prepare('DELETE FROM notification_settings').run();
  });

  describe('GET /api/settings/notifications', () => {
    test('should return default settings when none exist', async () => {
      const response = await request(app).get('/api/settings/notifications').expect(200);

      expect(response.body.settings).toEqual({
        agent_completion: true,
        ci_completion: true,
        browser_notifications: false,
      });
    });

    test('should return existing settings', async () => {
      // Create settings first
      notificationSettingsDb.upsertSettings(testUser.id, {
        agentCompletion: false,
        ciCompletion: true,
        browserNotifications: true,
      });

      const response = await request(app).get('/api/settings/notifications').expect(200);

      expect(response.body.settings).toEqual({
        agent_completion: false,
        ci_completion: true,
        browser_notifications: true,
      });
    });
  });

  describe('PUT /api/settings/notifications', () => {
    test('should create new notification settings', async () => {
      const response = await request(app)
        .put('/api/settings/notifications')
        .send({
          agentCompletion: true,
          ciCompletion: false,
          browserNotifications: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify settings were saved
      const settings = notificationSettingsDb.getSettings(testUser.id);
      expect(settings).toEqual({
        agent_completion: true,
        ci_completion: false,
        browser_notifications: true,
      });
    });

    test('should update existing notification settings', async () => {
      // Create initial settings
      notificationSettingsDb.upsertSettings(testUser.id, {
        agentCompletion: true,
        ciCompletion: true,
        browserNotifications: false,
      });

      // Update settings
      const response = await request(app)
        .put('/api/settings/notifications')
        .send({
          agentCompletion: false,
          ciCompletion: false,
          browserNotifications: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify settings were updated
      const settings = notificationSettingsDb.getSettings(testUser.id);
      expect(settings).toEqual({
        agent_completion: false,
        ci_completion: false,
        browser_notifications: true,
      });
    });

    test('should reject invalid input (non-boolean values)', async () => {
      const response = await request(app)
        .put('/api/settings/notifications')
        .send({
          agentCompletion: 'true', // string instead of boolean
          ciCompletion: true,
          browserNotifications: false,
        })
        .expect(400);

      expect(response.body.error).toBe('All notification settings must be boolean values');
    });

    test('should reject missing fields', async () => {
      const response = await request(app)
        .put('/api/settings/notifications')
        .send({
          agentCompletion: true,
          // missing ciCompletion and browserNotifications
        })
        .expect(400);

      expect(response.body.error).toBe('All notification settings must be boolean values');
    });

    test('should handle all settings set to false', async () => {
      const response = await request(app)
        .put('/api/settings/notifications')
        .send({
          agentCompletion: false,
          ciCompletion: false,
          browserNotifications: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      const settings = notificationSettingsDb.getSettings(testUser.id);
      expect(settings).toEqual({
        agent_completion: false,
        ci_completion: false,
        browser_notifications: false,
      });
    });

    test('should handle all settings set to true', async () => {
      const response = await request(app)
        .put('/api/settings/notifications')
        .send({
          agentCompletion: true,
          ciCompletion: true,
          browserNotifications: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      const settings = notificationSettingsDb.getSettings(testUser.id);
      expect(settings).toEqual({
        agent_completion: true,
        ci_completion: true,
        browser_notifications: true,
      });
    });
  });

  describe('Database Operations', () => {
    test('should create settings for new user', () => {
      const success = notificationSettingsDb.upsertSettings(testUser.id, {
        agentCompletion: true,
        ciCompletion: false,
        browserNotifications: true,
      });

      expect(success).toBe(true);

      const settings = notificationSettingsDb.getSettings(testUser.id);
      expect(settings).toEqual({
        agent_completion: true,
        ci_completion: false,
        browser_notifications: true,
      });
    });

    test('should update settings for existing user', () => {
      // Create initial settings
      notificationSettingsDb.upsertSettings(testUser.id, {
        agentCompletion: true,
        ciCompletion: true,
        browserNotifications: false,
      });

      // Update settings
      const success = notificationSettingsDb.upsertSettings(testUser.id, {
        agentCompletion: false,
        ciCompletion: true,
        browserNotifications: true,
      });

      expect(success).toBe(true);

      const settings = notificationSettingsDb.getSettings(testUser.id);
      expect(settings).toEqual({
        agent_completion: false,
        ci_completion: true,
        browser_notifications: true,
      });
    });

    test('should return null for non-existent user', () => {
      const settings = notificationSettingsDb.getSettings(999);
      expect(settings).toBeNull();
    });

    test('should enforce unique user_id constraint', () => {
      // Create settings
      notificationSettingsDb.upsertSettings(testUser.id, {
        agentCompletion: true,
        ciCompletion: true,
        browserNotifications: false,
      });

      // Try to create again - should update instead
      const success = notificationSettingsDb.upsertSettings(testUser.id, {
        agentCompletion: false,
        ciCompletion: false,
        browserNotifications: true,
      });

      expect(success).toBe(true);

      // Should have only one record
      const settings = notificationSettingsDb.getSettings(testUser.id);
      expect(settings).toEqual({
        agent_completion: false,
        ci_completion: false,
        browser_notifications: true,
      });
    });

    test('should handle multiple users independently', () => {
      // Create settings for user 1
      notificationSettingsDb.upsertSettings(testUser.id, {
        agentCompletion: true,
        ciCompletion: false,
        browserNotifications: false,
      });

      // Create settings for user 2
      notificationSettingsDb.upsertSettings(testUser2.id, {
        agentCompletion: false,
        ciCompletion: true,
        browserNotifications: true,
      });

      // Verify user 1 settings
      const settings1 = notificationSettingsDb.getSettings(testUser.id);
      expect(settings1).toEqual({
        agent_completion: true,
        ci_completion: false,
        browser_notifications: false,
      });

      // Verify user 2 settings
      const settings2 = notificationSettingsDb.getSettings(testUser2.id);
      expect(settings2).toEqual({
        agent_completion: false,
        ci_completion: true,
        browser_notifications: true,
      });
    });
  });
});
