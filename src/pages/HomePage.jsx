import React from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { fetchProducts } from "../lib/productsApi";

function HomePage() {
	const [featured, setFeatured] = React.useState([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState(null);

	React.useEffect(() => {
		let mounted = true;

		try {
			setLoading(true);
			setError(null);
			fetchProducts()
				.then((allProducts) => {
					if (!mounted) return;
					setFeatured(Array.isArray(allProducts) ? allProducts.slice(0, 3) : []);
				})
				.catch(() => {
					if (!mounted) return;
					setError("Something went wrong loading products.");
					setFeatured([]);
				})
				.finally(() => {
					if (!mounted) return;
					setLoading(false);
				});
		} catch {
			setError("Something went wrong loading products.");
			setFeatured([]);
		}

		return () => {
			mounted = false;
		};
	}, []);


	return (
		<div className="space-y-12 lg:space-y-16">
			{/* STATEMENT HERO (simplified, no container) */}
			<section className="pt-4 sm:pt-6 lg:pt-8">
				<div className="space-y-5 max-w-3xl mx-auto text-center">
					<h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-[#D4AF37] leading-tight">
						Glow with Intention
					</h1>
					<p className="text-base sm:text-lg text-white max-w-xl mx-auto">
						Vegan, organic skincare for Indian skin. Thoughtful rituals that honour your skin&apos;s rhythm and the climate it lives in.
					</p>
					<div className="flex flex-wrap gap-3 pt-2 justify-center">
						<Link
							to="/shop"
							className="inline-flex items-center rounded-full bg-[#D4AF37] px-7 py-3 text-sm font-medium text-neutral-900 hover:bg-[#c8a031] transition shadow-md"
						>
							Shop Now
						</Link>
					</div>
				</div>
			</section>

			{/* BRANDING BADGES */}
			<section className="space-y-3">
				<p className="text-2xl font-medium tracking-[0.2em] uppercase text-white text-center mx-auto w-fit border-2 border-[#D4AF37] px-4 py-2">
					What we stand for
				</p>
				<div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
					<div className="rounded-lg bg-[#D4AF37] px-5 py-5 text-xs sm:text-sm font-semibold text-neutral-900 flex flex-col items-center justify-center gap-3 shadow-sm border-2 border-transparent transition-all duration-700 badge-gold-hover">
						<div className="w-16 h-16 flex items-center justify-center rounded-full bg-white/70 shadow-inner">
							<svg aria-hidden="true" viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="#3d3d3d" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
								<path d="M12 3c-4 2.5-7 6-7 9.5 0 4.2 3.3 7.5 7 7.5s7-3.3 7-7.5C19 9 16 5.5 12 3Z" />
								<path d="M12 3v17" />
								<path d="M8.5 11.5l3.5 3.5 3.5-3.5" />
							</svg>
						</div>
						<span className="text-center leading-snug">100% Vegan & Cruelty Free</span>
					</div>
					<div className="rounded-lg bg-[#D4AF37] px-5 py-5 text-xs sm:text-sm font-semibold text-neutral-900 flex flex-col items-center justify-center gap-3 shadow-sm border-2 border-transparent transition-all duration-700 badge-gold-hover">
						<div className="w-16 h-16 flex items-center justify-center rounded-full bg-white/70 shadow-inner">
							<svg aria-hidden="true" viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="#3d3d3d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
								<rect x="3" y="11" width="18" height="10" rx="2" />
								<path d="M7 11V7a5 5 0 0 1 10 0v4" />
							</svg>
						</div>
						<span className="text-center leading-snug">Secure Payments</span>
					</div>
					<div className="rounded-lg bg-[#D4AF37] px-5 py-5 text-xs sm:text-sm font-semibold text-neutral-900 flex flex-col items-center justify-center gap-3 shadow-sm border-2 border-transparent transition-all duration-700 badge-gold-hover">
						<div className="w-16 h-16 flex items-center justify-center rounded-full bg-white/70 shadow-inner">
							<svg aria-hidden="true" viewBox="0 0 64 64" className="w-12 h-12" fill="none" stroke="#3d3d3d" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
								<circle cx="32" cy="32" r="20" />
								<path d="M12 32h40" />
								<path d="M32 12a30 30 0 0 1 0 40" />
								<path d="M32 12a30 30 0 0 0 0 40" />
							</svg>
						</div>
						<span className="text-center leading-snug">Pan India Shipping</span>
					</div>
					<div className="rounded-lg bg-[#D4AF37] px-5 py-5 text-xs sm:text-sm font-semibold text-neutral-900 flex flex-col items-center justify-center gap-3 shadow-sm border-2 border-transparent transition-all duration-700 badge-gold-hover">
						<div className="w-16 h-16 flex items-center justify-center rounded-full bg-white/70 shadow-inner">
							<svg aria-hidden="true" viewBox="0 0 64 64" className="w-11 h-11" fill="none" stroke="#3d3d3d" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M14 30h36l-3 12c-2 7-8 11-15 11s-13-4-15-11l-3-12Z" />
								<path d="M18 30c2 3 8 5 14 5s12-2 14-5" />
								<path d="M30 12l10 10-6 6-10-10" />
							</svg>
						</div>
						<span className="text-center leading-snug">Blended for Indian Skin</span>
					</div>
				</div>
			</section>

			{/* OUR STORY */}
			<section id="our-story" className="space-y-4">
				<h2 className="text-2xl sm:text-3xl font-semibold text-[#D4AF37] text-center">
					Our Story
				</h2>
				<div className="space-y-3 text-sm sm:text-base leading-relaxed text-white max-w-3xl mx-auto text-center">
					<p>
						We are proud to be one of the leading providers of vegan and organic
						personal care products in the market. Our products are designed to
						promote healthy living and to help you feel more connected with the
						beautiful world around us.
					</p>
					<p>
						We are passionate about creating effective, natural alternatives to
						traditional personal care products, and we believe that our approach
						can have a positive impact on both your health and the environment.
					</p>
					<p>
						If you&apos;re looking for quality skincare and haircare products
						that you can feel good about using, look no further than Advaya
						Care.
					</p>
				</div>
			</section>

			{/* FEATURED RITUALS */}
			{!loading && !error && featured.length > 0 && (
				<section className="space-y-4">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-2xl font-semibold text-[#D4AF37]">
							Featured Rituals
						</h2>
						<Link
							to="/shop"
							className="inline-flex items-center rounded-full bg-[#D4AF37] px-5 py-2 text-xs sm:text-sm font-medium text-black hover:bg-[#c8a031] transition shadow-md"
						>
							View all
						</Link>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
						{featured.map((product) => (
							<ProductCard key={product.id} product={product} />
						))}
					</div>
				</section>
			)}
			{loading && (
				<p className="text-center text-sm text-white/80">
					Loading featured rituals...
				</p>
			)}
			{!loading && error && (
				<p className="text-center text-sm text-red-400">
					{error}
				</p>
			)}
		</div>
	);
}

export default HomePage;

