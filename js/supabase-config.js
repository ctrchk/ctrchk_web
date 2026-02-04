// Supabase 配置文件
// 直接使用已載入的 Supabase
(function() {
    console.log('初始化 Supabase...');
    
    // 獲取當前域名
    const currentDomain = window.location.origin;
    
    // 等待 Supabase 庫載入
    function initSupabase() {
        if (typeof window.supabase !== 'undefined') {
            console.log('Supabase 已經初始化');
            return;
        }
        
        // 檢查 Supabase 庫是否載入
        if (typeof window.supabase === 'undefined') {
            // 檢查全局 supabase 對象是否存在且有 createClient 方法
            if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
                try {
                    window.supabase = supabase.createClient(
                        'https://umpxhvqcldmrmkuipmao.supabase.co',
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcHhodnFjbGRtcm1rdWlwbWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NTI0ODUsImV4cCI6MjA4MzUyODQ4NX0.-AOz3fXf-VRRt-OtnjZedknY8xw2IyRSgKRN1XEsCYY',
                        {
                            auth: {
                                redirectTo: `${currentDomain}/auth-callback.html`,
                                persistSession: true
                            }
                        }
                    );
                    console.log('Supabase 初始化成功，回調 URL:', `${currentDomain}/auth-callback.html`);
                } catch (error) {
                    console.error('Supabase 初始化失敗:', error);
                    // 繼續嘗試重新載入
                    setTimeout(initSupabase, 100);
                }
            } else {
                // 如果 Supabase 庫還沒載入，繼續等待
                console.log('等待 Supabase 庫載入...');
                setTimeout(initSupabase, 100);
            }
        }
    }
    
    // 開始初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSupabase);
    } else {
        initSupabase();
    }
})();
