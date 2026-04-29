const authService = require('./auth.service');
const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

async function login(req, res, next) {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await authService.login(validatedData.email, validatedData.password);
    res.success(result, 'Login successful');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.error(error.errors[0].message, 400);
    }
    if (error?.message === 'db_timeout') {
      return res.error('Database temporarily unavailable', 503);
    }
    if (error?.message === 'jwt_secret_missing') {
      return res.error('Service temporarily unavailable', 503);
    }
    if (typeof error?.name === 'string' && error.name.startsWith('Prisma')) {
      return res.error('Database temporarily unavailable', 503);
    }
    if (error?.message === 'Invalid email or password') {
      return res.error('Invalid email or password', 401);
    }
    res.error('Unauthorized', 401);
  }
}

module.exports = {
  login
};
