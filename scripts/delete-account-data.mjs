import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node delete-account-data.mjs <email>');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: userList, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr) throw userErr;
  const user = userList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`No auth user found for ${email}`);
    process.exit(1);
  }
  console.log(`Found admin id: ${user.id} (${user.email})`);

  const { data: properties, error: propErr } = await supabase
    .from('properties')
    .select('id, name')
    .eq('admin_id', user.id);
  if (propErr) throw propErr;
  console.log(`Properties: ${properties.length}`);

  if (properties.length === 0) {
    console.log('No properties for this admin. Nothing to delete.');
    return;
  }
  const propertyIds = properties.map((p) => p.id);

  const { data: rooms, error: roomErr } = await supabase
    .from('rooms')
    .select('id, room_number')
    .in('property_id', propertyIds);
  if (roomErr) throw roomErr;
  console.log(`Rooms: ${rooms.length}`);
  const roomIds = rooms.map((r) => r.id);

  let tenantCount = 0;
  if (roomIds.length > 0) {
    const { data: tenants, error: tenantErr } = await supabase
      .from('tenants')
      .select('id')
      .in('room_id', roomIds);
    if (tenantErr) throw tenantErr;
    tenantCount = tenants.length;
    console.log(`Tenants: ${tenantCount}`);

    if (tenantCount > 0) {
      const tenantIds = tenants.map((t) => t.id);
      const { error: delTenantErr } = await supabase.from('tenants').delete().in('id', tenantIds);
      if (delTenantErr) throw delTenantErr;
      console.log(`Deleted ${tenantIds.length} tenants (bills/payments/notification_logs cascade).`);
    }
  }

  if (roomIds.length > 0) {
    const { error: delRoomErr } = await supabase.from('rooms').delete().in('id', roomIds);
    if (delRoomErr) throw delRoomErr;
    console.log(`Deleted ${roomIds.length} rooms (electricity_readings cascade).`);
  }

  console.log('Done. Properties were left intact.');
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
