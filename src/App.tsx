import { type ReactNode, useEffect } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import HomePage from '@/pages/home';
import RegisterPage from '@/pages/register';
import { LanguageProvider } from '@/lib/language';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { useLenis, resetScroll } from '@/hooks/use-lenis';

function Router() {
  const [location] = useLocation();

  // Lenis is initialized once for the whole app.
  useLenis();

  // Scroll to top when navigating between routes (wouter does not do this).
  useEffect(() => {
    resetScroll();
  }, [location]);

  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={HomePage} />
    <Route path="/register" component={RegisterPage} />
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <LanguageProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
    </LanguageProvider>
  );
}

export default App;
