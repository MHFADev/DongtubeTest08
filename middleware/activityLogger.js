import { ActivityLog } from '../models/index.js';

export const logActivity = async (userId, action, targetType, targetId, details, req) => {
  try {
    const ipAddress = req?.ip || req?.connection?.remoteAddress || null;
    const userAgent = req?.headers['user-agent'] || null;

    await ActivityLog.create({
      userId,
      action,
      targetType,
      targetId,
      details,
      ipAddress,
      userAgent
    });
  } catch (error) {
    console.error('Activity logging error:', error);
  }
};

export const activityLoggerMiddleware = (action) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      if (res.statusCode < 400 && req.user) {
        logActivity(
          req.user.id,
          action,
          null,
          null,
          {
            method: req.method,
            path: req.path,
            body: req.body,
            params: req.params,
            query: req.query
          },
          req
        ).catch(err => console.error('Activity log error:', err));
      }
      
      originalSend.apply(res, arguments);
    };
    
    next();
  };
};

export default { logActivity, activityLoggerMiddleware };
