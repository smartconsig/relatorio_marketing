const SUPA_URL = 'https://gfxfuzmoywdsiyctkrux.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmeGZ1em1veXdkc2l5Y3RrcnV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MDk0NzMsImV4cCI6MjA5Mjk4NTQ3M30.zknUCd0TrOmgLUxeRcx5VWZFb-Ag-L5_v00F267Owug';

// supabase-js loaded via CDN — available as window.supabase
export const sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);
