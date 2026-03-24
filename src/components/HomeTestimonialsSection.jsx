import React from "react";
import CommentCard from "./CommentCard";
import CommentForm from "./CommentForm";
import { createHomeTestimonial, listHomeTestimonials } from "../lib/commentsApi";

function HomeTestimonialsSection() {
  const [testimonials, setTestimonials] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    listHomeTestimonials()
      .then((rows) => {
        if (!mounted) return;
        setTestimonials(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!mounted) return;
        setTestimonials([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <div className="space-y-2 text-center max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-semibold text-[#D4AF37]">What Members Are Saying</h2>
        <p className="text-sm sm:text-base leading-relaxed text-white/82">
          Real notes from members who keep Advaya Care in their routines. Every testimonial is reviewed before it goes live.
        </p>
      </div>

      {loading ? <p className="text-sm text-center text-white/75">Loading testimonials...</p> : null}

      {!loading && testimonials.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          {testimonials.map((comment) => (
            <CommentCard key={comment.id} comment={comment} variant="home" />
          ))}
        </div>
      ) : null}

      {!loading && testimonials.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-700 bg-black/40 px-5 py-8 text-center max-w-3xl mx-auto space-y-2">
          <p className="text-base font-medium text-white">This section starts with real member stories only.</p>
          <p className="text-sm text-white/72">
            No filler quotes, no invented social proof. The first approved testimonial from a member will appear here.
          </p>
        </div>
      ) : null}

      <CommentForm
        title="Share Your Advaya Care Experience"
        description="Tell other members what keeps you coming back. Your testimonial will appear on the home page after approval."
        submitLabel="Submit Testimonial"
        successMessage="Submitted for approval. It will appear here after review."
        onSubmit={createHomeTestimonial}
        variant="home"
      />
    </section>
  );
}

export default HomeTestimonialsSection;