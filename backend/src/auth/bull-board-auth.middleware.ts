import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/environment';

export function bullBoardAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  if (env.AUTH_DISABLED) return next();

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ message: 'Unauthorized', statusCode: 401 });
    return;
  }

  try {
    jwt.verify(token, env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized', statusCode: 401 });
  }
}
