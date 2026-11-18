import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, X } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { img } from '../lib/format';
import { Button, EmptyState, PageHeader, Price, usePageTitle } from '../components/ui';

export default function Wishlist() {
  usePageTitle('Wishlist');
  const navigate = useNavigate();
  const { wishlist, toggleWishlist, addToCart } = useShop();

  // Simple products go straight to the cart; products with options need a size chosen first.
  const moveToCart = async (product) => {
    if (product.hasVariants) {
      navigate(`/product/${product.slug}`);
      return;
    }
    addToCart(product);
    await toggleWishlist(product);
  };

  return (
    <>
      <PageHeader eyebrow="Saved for later" title="Wishlist" description={wishlist.length ? `${wishlist.length} ${wishlist.length === 1 ? 'item' : 'items'} saved` : undefined} />
      <div className="container-page py-10">
        {!wishlist.length ? (
          <EmptyState icon={Heart} title="Nothing saved yet" description="Tap the heart on any product to keep it here for later.">
            <Link to="/shop" className="btn btn-primary">Browse products</Link>
          </EmptyState>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {wishlist.map((p) => (
              <li key={p.id} className="card relative flex gap-4 p-4">
                <Link to={`/product/${p.slug}`} className="w-24 shrink-0 overflow-hidden rounded-xl bg-sand-100 sm:w-28">
                  <img src={img(p.image)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col pr-8">
                  {p.category && <p className="text-xs font-medium tracking-wide text-ink-400 uppercase">{p.category.name}</p>}
                  <h2 className="mt-0.5 font-sans text-base leading-snug font-semibold tracking-normal">
                    <Link to={`/product/${p.slug}`} className="-my-1.5 line-clamp-2 py-1.5 hover:text-brand-600">{p.name}</Link>
                  </h2>
                  <Price className="mt-1.5" price={p.price} compare={p.comparePrice} from={p.hasVariants} size="sm" />
                  <div className="mt-auto pt-3">
                    <Button size="sm" variant={p.inStock ? 'primary' : 'outline'} disabled={!p.inStock} onClick={() => moveToCart(p)}>
                      <ShoppingBag className="size-4" aria-hidden />
                      {!p.inStock ? 'Sold out' : p.hasVariants ? 'Choose options' : 'Move to cart'}
                    </Button>
                  </div>
                </div>
                <button type="button" onClick={() => toggleWishlist(p)} aria-label={`Remove ${p.name} from wishlist`} className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-full text-ink-400 hover:bg-sand-100 hover:text-clay-600">
                  <X className="size-[18px]" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
