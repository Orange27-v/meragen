import Link from 'next/link';
import VoiceDemo from '@/components/VoiceDemo';
import './landing.css';

/**
 * The landing page, at `/`. The first thing a visitor sees.
 *
 * Written for three people who actually exist in this market: the vendor
 * selling on Instagram and WhatsApp, the social media manager running eight
 * client accounts, and the estate agent with a flat to move. Everything here is
 * something the product genuinely does — no invented customers, no borrowed
 * statistics, no "trusted by thousands" before a single sale.
 *
 * Prices are correct as of the credit change (1 credit = ₦50) and are checked
 * against the API. `/pricing` reads them live; if these drift, move them there.
 */
export const metadata = {
  title: 'Meerah — AI video for Nigerian creators',
  description:
    'Videos, product shots and voiceovers for Nigerian businesses. Made in minutes, paid for in Naira, in your own voice — Pidgin, Yorùbá, Igbo or Hausa.',
};

export default function Landing() {
  return (
    <>
      <nav className="nav">
        <div className="shell nav-in">
          <Link className="wordmark" href="/"><span className="mark" />Meerah</Link>
          <div className="nav-links">
            <Link href="#voice">MyVoice</Link>
            <Link href="#tools">What you can make</Link>
            <Link href="#how">How it works</Link>
            <Link href="/pricing">Pricing</Link>
          </div>
          <Link className="btn btn-ghost" href="/signin">Sign in</Link>
          <Link className="btn btn-primary" href="/signin">Start free</Link>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <header className="hero" id="top">
        <div className="shell hero-grid">
          <div>
            <p className="eyebrow">Pay in Naira · No foreign card</p>
            <h1 className="display">Make the ad.<br />In <em>your own</em> voice.</h1>
            <p className="hero-sub">
              Videos, product shots and voiceovers for your business — finished in the time it takes
              to reply a message. No camera, no videographer, and no dollar card. Just describe what
              you want and pay in Naira.
            </p>
            <div className="hero-cta">
              <Link className="btn btn-primary btn-lg" href="/signin">Start with Google</Link>
              <Link className="btn btn-ghost btn-lg" href="#voice">Hear it in Pidgin</Link>
            </div>
            <div className="hero-note">
              <span><b className="tick">✓</b> Card, transfer or USSD</span>
              <span><b className="tick">✓</b> No subscription</span>
              <span><b className="tick">✓</b> Credits never expire</span>
            </div>
          </div>

          <VoiceDemo />
        </div>
      </header>

      {/* ── Why this exists ───────────────────────────────────────────────── */}
      <section className="band">
        <div className="shell">
          <div className="sec-head">
            <p className="eyebrow">Why this exists</p>
            <h2 className="display">Good content costs too much. Bad content costs more.</h2>
          </div>
          <div className="plain">
            <p>
              A proper product shoot costs more than most vendors clear on the item they are shooting.
              So the post goes up as a flat photo at eleven at night, sitting between a hundred others,
              and the thumb keeps moving.
            </p>
            <p>
              The global AI tools would fix that — except they price in dollars, ask for a card your
              bank will decline, and hand your Yorùbá script to a voice that has never heard the
              language. You end up paying in a currency you do not earn, for an accent your customers
              do not trust.
            </p>
            <p>
              <strong>Meerah is those tools, built for the person actually selling.</strong> Naira in,
              finished work out, in a voice your market recognises.
            </p>
          </div>
        </div>
      </section>

      {/* ── The two differentiators ───────────────────────────────────────── */}
      <section id="voice">
        <div className="shell">
          <div className="sec-head">
            <p className="eyebrow">The part nobody else does</p>
            <h2 className="display">Two things the free apps cannot give you</h2>
            <p>
              Anyone can generate a video now — that race is over. These are the parts that make the
              work unmistakably yours.
            </p>
          </div>
          <div className="wedge">
            <div>
              <p className="tag">MyVoice</p>
              <h3>Your own voice, in your own language</h3>
              <p>
                Record five seconds. Say your name, say what you sell — anything.
              </p>
              <p>
                From then on every voiceover is you, speaking Pidgin, Yorùbá, Igbo or Hausa, saying
                words you never recorded. Your customer hears someone who sounds like home, not a
                stranger with an American accent trying to pronounce Ikeja.
              </p>
            </div>
            <div>
              <p className="tag">BrandFace</p>
              <h3>The same face, every single post</h3>
              <p>
                Save a face, a voice and a look once. Every video after that carries them.
              </p>
              <p>
                Post for a few weeks and something changes: people stop reading the handle. They know
                it is you from the thumbnail alone. That recognition is what turns a vendor into a
                brand — and it is the one thing a free editing app structurally cannot hand you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Who it is for ─────────────────────────────────────────────────── */}
      <section className="band">
        <div className="shell">
          <div className="sec-head">
            <p className="eyebrow">Built for</p>
            <h2 className="display">People who post to sell, not to show off</h2>
          </div>
          <div className="features">
            <div className="feat">
              <h4>The vendor</h4>
              <p>
                New stock every week and no time to shoot it. Photograph it once on your phone, and
                Meerah turns it into a video worth stopping for — with your own voice over the top.
              </p>
            </div>
            <div className="feat">
              <h4>The social media manager</h4>
              <p>
                Eight clients, eight tones of voice, one of you. Save a look and a voice per client,
                then plan the week on Sunday and let it make itself.
              </p>
            </div>
            <div className="feat">
              <h4>The estate agent</h4>
              <p>
                A flat that needs to move this month. Turn the listing photos into a walkthrough with
                a voiceover in the language your buyer actually speaks.
              </p>
            </div>
            <div className="feat">
              <h4>The small agency</h4>
              <p>
                Client work at volume, with margins that survive it. Consistent characters, saved brand
                kits, and a bill in Naira you can actually pass on.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tools ─────────────────────────────────────────────────────────── */}
      <section id="tools">
        <div className="shell">
          <div className="sec-head">
            <p className="eyebrow">What you can make</p>
            <h2 className="display">Twelve tools, one account</h2>
            <p>
              Six hundred models underneath, arranged around what you are actually trying to sell.
            </p>
          </div>

          <p className="eyebrow" style={{ marginBottom: '.75rem' }}>Video</p>
          <div className="features" style={{ marginBottom: '2.25rem' }}>
            <div className="feat"><h4>VidEngine</h4><p>A photo of your product becomes a moving advert. Choose the quality, see the price before you spend a naira.</p></div>
            <div className="feat"><h4>Vibe Reel</h4><p>Pick a look, not a hundred settings. Motion presets that already feel finished.</p></div>
            <div className="feat"><h4>ShotDirector</h4><p>Describe the scene the way you would to a videographer. Get the shot list and the footage.</p></div>
            <div className="feat"><h4>Snip Reel</h4><p>One long video becomes a week of clips, cut for Status and Reels.</p></div>
          </div>

          <p className="eyebrow" style={{ marginBottom: '.75rem' }}>Image</p>
          <div className="features" style={{ marginBottom: '2.25rem' }}>
            <div className="feat"><h4>PixCraft</h4><p>Packshots, flyers and thumbnails from a sentence. No studio, no lighting, no waiting.</p></div>
            <div className="feat"><h4>Patch Up</h4><p>Remove the clutter behind the product. Replace a background. Fix the thing that spoils an otherwise good shot.</p></div>
          </div>

          <p className="eyebrow" style={{ marginBottom: '.75rem' }}>People</p>
          <div className="features" style={{ marginBottom: '2.25rem' }}>
            <div className="feat"><h4>TalkSync</h4><p>Make a face speak your script, lips matching, in any of the four languages.</p></div>
            <div className="feat"><h4>Body Double</h4><p>New outfit, same person. Show the whole rack without booking the model twice.</p></div>
            <div className="feat"><h4>Star Maker</h4><p>One consistent face that fronts everything you post — and never asks for a fee.</p></div>
          </div>

          <p className="eyebrow" style={{ marginBottom: '.75rem' }}>Selling</p>
          <div className="features" style={{ marginBottom: '2.25rem' }}>
            <div className="feat"><h4>Sales Reel</h4><p>Ad creative shaped for Instagram, WhatsApp Status and TikTok, not resized as an afterthought.</p></div>
            <div className="feat"><h4>SoundTrack</h4><p>Original music and voiceover. Nothing that gets your post muted for copyright.</p></div>
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="band" id="how">
        <div className="shell">
          <div className="sec-head">
            <p className="eyebrow">How it works</p>
            <h2 className="display">Three steps, and none of them involve a camera</h2>
          </div>
          <div className="steps">
            <div className="step">
              <h4>Buy credits</h4>
              <p>
                Card, bank transfer or USSD through Paystack. Naira, no conversion, no international
                card. From ₦500 if you just want to try one thing.
              </p>
            </div>
            <div className="step">
              <h4>Describe it</h4>
              <p>
                Type what you want to see, the way you would explain it to a person. The price shows
                before you press anything, and updates as you change the settings.
              </p>
            </div>
            <div className="step">
              <h4>Post it</h4>
              <p>
                Download in the right size for wherever it is going. If a generation fails, the credits
                come straight back — you never pay for something you did not get.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section id="pricing">
        <div className="shell">
          <div className="sec-head">
            <p className="eyebrow">Pricing</p>
            <h2 className="display">Pay for what you make. Nothing else.</h2>
            <p>
              No monthly fee, no tier you forget to cancel, no card sitting on file. Credits stay in
              your account until you use them — there is no ninety-day clock.
            </p>
          </div>

          <div className="packs">
            <div className="pack">
              <span className="pack-name">Starter</span>
              <span className="pack-price">₦2,000</span>
              <span className="pack-credits">40 credits</span>
              <span className="pack-bonus">&nbsp;</span>
              <Link className="btn btn-ghost" href="/signin">Get Starter</Link>
            </div>
            <div className="pack featured">
              <span className="pack-name">Creator</span>
              <span className="pack-price">₦5,000</span>
              <span className="pack-credits">105 credits</span>
              <span className="pack-bonus">+5 free</span>
              <Link className="btn btn-primary" href="/signin">Get Creator</Link>
            </div>
            <div className="pack">
              <span className="pack-name">Business</span>
              <span className="pack-price">₦15,000</span>
              <span className="pack-credits">330 credits</span>
              <span className="pack-bonus">+30 free</span>
              <Link className="btn btn-ghost" href="/signin">Get Business</Link>
            </div>
            <div className="pack">
              <span className="pack-name">Agency</span>
              <span className="pack-price">₦50,000</span>
              <span className="pack-credits">1,150 credits</span>
              <span className="pack-bonus">+150 free</span>
              <Link className="btn btn-ghost" href="/signin">Get Agency</Link>
            </div>
          </div>

          <div className="price-strip">
            <div>A 5-second video from<b>₦300</b></div>
            <div>A product image from<b>₦150</b></div>
            <div>Your work stays downloadable for<b>1 year</b></div>
            <div>Credits expire in<b>Never</b></div>
          </div>

          <p className="muted" style={{ marginTop: '1.25rem', fontSize: 'var(--text-caption)' }}>
            Or pay as you go from ₦500 — buy exactly what one job needs, nothing more.{' '}
            <Link href="/pricing">See the full price list</Link>.
          </p>
        </div>
      </section>

      {/* ── The honest bit ────────────────────────────────────────────────── */}
      <section className="band">
        <div className="shell plain">
          <p className="eyebrow">Straight talk</p>
          <h2 className="display">There is no free plan, and here is why</h2>
          <p>
            Every generation costs us real money the moment you press the button. We could hide that
            behind a free tier and make paying customers fund the people who never pay — most platforms
            do — but the bill always lands somewhere, and it usually lands on you.
          </p>
          <p>
            <strong>So here is the trade.</strong> You pay for what you make, from ₦500. In return: no
            subscription, no card kept on file, no credits quietly expiring after ninety days to force a
            renewal, and no month where you are billed for a tool you did not open.
          </p>
          <p>
            If a generation fails, the credits go back to your account automatically. You should never
            have to ask.
          </p>
        </div>
      </section>

      {/* ── Questions ─────────────────────────────────────────────────────── */}
      <section>
        <div className="shell">
          <div className="sec-head">
            <p className="eyebrow">Before you start</p>
            <h2 className="display">The questions people actually ask</h2>
          </div>
          <div className="features">
            <div className="feat">
              <h4>Do I need a camera or any equipment?</h4>
              <p>No. A phone photo of your product is enough, and for some tools you do not even need that — a description will do.</p>
            </div>
            <div className="feat">
              <h4>Will it really sound like me?</h4>
              <p>MyVoice is built from a five-second recording of your own voice, and it speaks Pidgin, Yorùbá, Igbo and Hausa. Try it before you buy anything.</p>
            </div>
            <div className="feat">
              <h4>Can I pay without a dollar card?</h4>
              <p>Yes — that is the point. Card, bank transfer or USSD through Paystack, priced in Naira. Nothing is converted.</p>
            </div>
            <div className="feat">
              <h4>What if I do not like what it makes?</h4>
              <p>Change the description and go again. You are charged per generation, so a second attempt costs the same as the first — and a failed one costs nothing.</p>
            </div>
            <div className="feat">
              <h4>Do my credits run out?</h4>
              <p>Never, while your account is open. Buy ₦5,000 today and spend the last of it next year if that suits you.</p>
            </div>
            <div className="feat">
              <h4>Can I use this for client work?</h4>
              <p>Yes. Save a separate voice, face and brand kit for each client, and keep the margin on what you charge them.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Close ─────────────────────────────────────────────────────────── */}
      <section className="band">
        <div className="shell plain" style={{ textAlign: 'center', maxWidth: '46ch', marginInline: 'auto' }}>
          <h2 className="display">Your next post is due tonight</h2>
          <p>Start with Google, buy ₦500 of credits, and have something ready before you finish your tea.</p>
          <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', marginTop: '2rem', flexWrap: 'wrap' }}>
            <Link className="btn btn-primary btn-lg" href="/signin">Start with Google</Link>
            <Link className="btn btn-ghost btn-lg" href="/pricing">See pricing</Link>
          </div>
        </div>
      </section>

      <footer>
        <div className="shell foot">
          <Link className="wordmark" href="/"><span className="mark" />Meerah</Link>
          <div className="foot-links">
            <Link href="#voice">MyVoice</Link>
            <Link href="#tools">What you can make</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="#how">How it works</Link>
          </div>
          <p className="foot-note">
            Built in Nigeria, for Nigerian vendors, creators, agents and agencies. Prices in Naira,
            payments handled by Paystack. Voice available in Nigerian Pidgin, Yorùbá, Igbo and Hausa.
          </p>
        </div>
      </footer>
    </>
  );
}
