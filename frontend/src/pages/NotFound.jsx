import { Link } from 'react-router-dom';
import { usePageTitle } from '../components/ui';

export default function NotFound() {
  usePageTitle('Page not found');
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-8xl font-medium text-brand-200">404</p>
      <h1 className="mt-4 text-3xl font-medium sm:text-4xl">This path leads nowhere</h1>
      <p className="mt-3 max-w-md text-ink-500">The page you are looking for has moved or no longer exists.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn btn-primary">Back to home</Link>
        <Link to="/shop" className="btn btn-outline">Browse products</Link>
      </div>
    </div>
  );
}
