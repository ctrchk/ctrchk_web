// Supabase 配置文件
// 使用傳統方式載入 Supabase
(function() {
    // 等待 Supabase 庫載入
    function loadSupabase() {
        if (typeof createClient !== 'undefined') {
            window.supabase = createClient(
                'https://umpxhvqcldmrmkuipmao.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcHhodnFjbGRtcm1rdWlwbWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NTI0ODUsImV4cCI6MjA4MzUyODQ4NX0.-AOz3fXf-VRRt-OtnjZedknY8xw2IyRSgKRN1XEsCYY',
                {
                    auth: {
                        redirectTo: `${window.location.origin}/auth-callback.html`
                    }
                }
            );
            console.log('Supabase 初始化成功');
        } else {
            // 如果 Supabase 庫還沒載入，等待後再試
            setTimeout(loadSupabase, 100);
        }
    }
    
    // 載入 Supabase SDK
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = loadSupabase;
    document.head.appendChild(script);
})();
