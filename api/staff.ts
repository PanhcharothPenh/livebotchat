import type { IncomingMessage, ServerResponse } from 'http';
import { StaffService } from '../src/services/staffService.js';
import { logger } from '../src/utils/logger.js';

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const host = req.headers.host || 'localhost';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const urlObj = new URL(req.url || '/', `${protocol}://${host}`);

  // Check if Supabase credentials are configured in Vercel
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    res.statusCode = 400;
    res.end(
      JSON.stringify(
        {
          success: false,
          error:
            'សូមកំណត់ SUPABASE_URL និង SUPABASE_SERVICE_ROLE_KEY នៅក្នុង Vercel Environment Variables ជាមុនសិន។ (Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel settings and Redeploy).',
        },
        null,
        2
      )
    );
    return;
  }

  try {
    // 1. GET - List all staff
    if (req.method === 'GET') {
      const staffList = await StaffService.getAllStaff();
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, staff: staffList }, null, 2));
      return;
    }

    // 2. POST - Add or update staff member
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const { telegram_username, display_name_km, role, telegram_user_id } = body;

      if (!telegram_username || !display_name_km) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'telegram_username and display_name_km are required.' }));
        return;
      }

      const result = await StaffService.upsertStaff({
        telegram_username,
        display_name_km,
        role,
        telegram_user_id: telegram_user_id ? parseInt(telegram_user_id, 10) : null,
      });

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, message: 'Staff saved successfully', staff: result }, null, 2));
      return;
    }

    // 3. DELETE - Delete staff member
    if (req.method === 'DELETE') {
      const id = urlObj.searchParams.get('id') || urlObj.searchParams.get('username');
      if (!id) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Staff id or username parameter is required.' }));
        return;
      }

      await StaffService.deleteStaff(id);
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, message: `Staff '${id}' deleted successfully` }, null, 2));
      return;
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('Staff API Error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: errorMsg }));
  }
}
