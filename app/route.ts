import portfolio from '../content/portfolio.html?raw';
export const dynamic = 'force-dynamic';
export function GET() {
  return new Response(portfolio, {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
}
