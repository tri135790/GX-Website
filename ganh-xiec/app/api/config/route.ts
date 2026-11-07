export async function GET() {
 const url=process.env.SUPABASE_URL||''; const key=process.env.SUPABASE_ANON_KEY||'';
 return Response.json({url,key,configured:!!(url&&key)},{headers:{'Cache-Control':'no-store'}});
}
