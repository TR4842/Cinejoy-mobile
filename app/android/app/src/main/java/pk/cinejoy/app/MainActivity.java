package pk.cinejoy.app;

import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Edge-to-edge dark chrome: the web app draws its own safe-area padding.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
        getWindow().setStatusBarColor(android.graphics.Color.parseColor("#08080B"));
        getWindow().setNavigationBarColor(android.graphics.Color.parseColor("#08080B"));

        // Hardware-accelerated WebView tuned for fullscreen video playback.
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);
        }

        // Keep the screen on while a video is playing.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    public void onBackPressed() {
        WebView webView = getBridge().getWebView();
        // Let the SPA handle its own history first (player → detail → home).
        if (webView != null && webView.canGoBack()) {
            webView.evaluateJavascript(
                "(function(){ if (window.__cinejoyBack && window.__cinejoyBack()) return 'handled';" +
                " window.history.back(); return 'history'; })()",
                null
            );
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
