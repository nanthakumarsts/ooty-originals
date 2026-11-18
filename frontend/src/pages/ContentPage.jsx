import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatDate } from '../lib/format';
import { Alert, PageHeader, usePageTitle } from '../components/ui';
import { PageSkeleton } from '../components/Skeletons';

/** Policy pages whose text is managed from the admin panel. */
export default function ContentPage({ slug }) {
  const [page, setPage] = useState(null);
  const [error, setError] = useState('');
  usePageTitle(page?.title || '');

  useEffect(() => {
    setPage(null);
    setError('');
    api.get(`/content/pages/${slug}`).then((d) => setPage(d.page)).catch((err) => setError(err.message));
  }, [slug]);

  if (error) return <div className="container-page py-16"><Alert>{error}</Alert></div>;
  if (!page) return <PageSkeleton text />;

  return (
    <>
      <PageHeader title={page.title} description={`Last updated ${formatDate(page.updated_at)}`} />
      <article className="container-page max-w-3xl py-12 lg:py-16">
        <div className="rich" dangerouslySetInnerHTML={{ __html: page.content }} />
      </article>
    </>
  );
}
