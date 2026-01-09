// Supabase 配置文件
import { createClient } from '@supabase/supabase-js'

// 請替換為您的 Supabase 憑證
const supabaseUrl = 'https://umpxhvqcldmrmkuipmao.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcHhodnFjbGRtcm1rdWlwbWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NTI0ODUsImV4cCI6MjA4MzUyODQ4NX0.-AOz3fXf-VRRt-OtnjZedknY8xw2IyRSgKRN1XEsCYY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        redirectTo: `${window.location.origin}/auth-callback.html`
    }
})
