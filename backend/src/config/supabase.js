import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || 'https://nophkqduiyxjwtcmwoes.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcGhrcWR1aXl4and0Y213b2VzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzcwMzkxMiwiZXhwIjoyMDc5Mjc5OTEyfQ.BVqZym2tZ1wAfJodpn8staorxotXWDoN_Bu_gwZkZQM'

export const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default supabase