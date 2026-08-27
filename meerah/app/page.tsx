/**
 * The landing page, at `/`. The first thing a visitor sees.
 *
 * Styles come from `landing.css`; the palette tokens it uses are defined in
 * `globals.css`. The one live element is <VoiceDemo />, which cycles the same
 * sentence through Pidgin, Yorùbá, Igbo and Hausa — the claim no global
 * competitor can make, so it moves above the fold rather than sitting in a
 * feature list.
 *
 * Prices in the pack cards are hardcoded here. They match the API today; if a
 * pack price changes, change it in both places or move this to `/pricing`,
 * which reads them live.
 */
import Link from 'next/link';
import VoiceDemo from '@/components/VoiceDemo';
import './landing.css';

export const metadata = {
  title: 'Meerah — AI video for Nigerian creators',
  description:
    'Video, images and voiceover for Nigerian businesses. Pay in Naira through Paystack. Credits never expire.',
};

export default function Landing() {
  return (
    <>
      <nav className="nav">
        <div className="shell nav-in">
          <a className="wordmark" href="#top"><span className="mark" />Meerah</a>
          <div className="nav-links">
            <a href="#voice">MyVoice</a>
            <a href="#tools">Tools</a>
            <a href="#how">How it works</a>
            <Link href="/pricing">Pricing</Link>
          </div>
          <Link className="btn btn-primary" href="/signin">Sign in with Google</Link>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="adire"></div>
        <div className="shell hero-grid">
          <div>
            <p className="eyebrow">Pay in Naira · No foreign card</p>
            <h1 className="display">Make the ad.<br />In <em>your own</em> voice.</h1>
            <p className="hero-sub">
              Video, images, voiceover and ad creative for Nigerian businesses — generated in minutes,
              paid for in Naira, with credits that never expire.
            </p>
            <div className="hero-cta">
              <Link className="btn btn-primary btn-lg" href="/signin">Start with Google</Link>
              <a className="btn btn-ghost btn-lg" href="#voice">Hear MyVoice</a>
            </div>
            <div className="hero-note">
              <span><b className="tick">✓</b> Paystack, transfer or USSD</span>
              <span><b className="tick">✓</b> No subscription</span>
              <span><b className="tick">✓</b> Credits never expire</span>
            </div>
          </div>

          <VoiceDemo />
          </div>
      </header>

      <section className="band">
        <div className="shell">
          <div className="sec-head">
            <p className="eyebrow">Why this, and not the free apps</p>
            <h2 className="display">Two things they cannot copy</h2>
            <p>Anyone can generate a video now. These are the parts that make the work yours.</p>
          </div>
          <div className="wedge">
            <div>
              <p className="tag">MyVoice</p>
              <h3>Your voice, in your language</h3>
              <p>
                Record five seconds. Get voiceovers in your own voice — in Pidgin, Yorùbá, Igbo or Hausa.
                Not a stiff American accent reading your Lagos property listing.
              </p>
            </div>
            <div>
              <p className="tag">BrandFace</p>
              <h3>The same face, every time</h3>
              <p>
                Save a character, a voice and a brand look once. Every video after that stays consistent —
                so a customer scrolling past recognises you before they read a word.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="tools">
        <div className="shell">
          <div className="sec-head">
            <p className="eyebrow">The studio</p>
            <h2 className="display">Twelve tools, one account</h2>
            <p>600+ models behind a set of tools built for selling, not for showing off.</p>
          </div>
            <p className="eyebrow" style={{ marginBottom: '.75rem' }}>Video</p>
            <div className="features" style={{ marginBottom: '2.25rem' }}>
              <div className="feat"><h4>VidEngine</h4><p>Text or photo to video. Pick your quality, see the price before you spend.</p></div>
              <div className="feat"><h4>Vibe Reel</h4><p>One-tap motion presets. Pick a look, not a hundred settings.</p></div>
              <div className="feat"><h4>ShotDirector</h4><p>Describe the scene, get the shot list and the footage.</p></div>
              <div className="feat"><h4>Snip Reel</h4><p>Turn one long video into clips ready for Status and Reels.</p></div>
            </div>
            <p className="eyebrow" style={{ marginBottom: '.75rem' }}>Image</p>
            <div className="features" style={{ marginBottom: '2.25rem' }}>
              <div className="feat"><h4>PixCraft</h4><p>Product shots, flyers and thumbnails from a description.</p></div>
              <div className="feat"><h4>Patch Up</h4><p>Remove, replace or repair anything in a frame.</p></div>
            </div>
            <p className="eyebrow" style={{ marginBottom: '.75rem' }}>People</p>
            <div className="features" style={{ marginBottom: '2.25rem' }}>
              <div className="feat"><h4>TalkSync</h4><p>Make any face speak your script, lips matching.</p></div>
              <div className="feat"><h4>Body Double</h4><p>Swap the body, keep the face. New outfit, same person.</p></div>
              <div className="feat"><h4>Star Maker</h4><p>One consistent face that fronts everything you post.</p></div>
            </div>
            <p className="eyebrow" style={{ marginBottom: '.75rem' }}>Selling</p>
            <div className="features" style={{ marginBottom: '2.25rem' }}>
              <div className="feat"><h4>Sales Reel</h4><p>Ad creative built for Instagram, WhatsApp Status and TikTok.</p></div>
              <div className="feat"><h4>SoundTrack</h4><p>Original music and voiceover, no copyright strike waiting to happen.</p></div>
            </div>
            <p className="eyebrow" style={{ marginBottom: '.75rem' }}>More</p>
            <div className="features" style={{ marginBottom: '2.25rem' }}>
              <div className="feat"><h4>App Shelf</h4><p>Tell us what to build next. We count the votes.</p></div>
            </div>
        </div>
      </section>

      <section className="band" id="how">
        <div className="shell">
          <div className="sec-head">
            <p className="eyebrow">How it works</p>
            <h2 className="display">Three steps</h2>
          </div>
          <div className="steps">
            <div className="step">
              <h4>Buy credits</h4>
              <p>Card, bank transfer or USSD through Paystack. Naira, no dollar conversion, no international card needed.</p>
            </div>
            <div className="step">
              <h4>Make the thing</h4>
              <p>Pick a tool, describe what you want. The price shows before you generate — and changes as you change the settings.</p>
            </div>
            <div className="step">
              <h4>Post it</h4>
              <p>Download in the right size for wherever it's going. If a generation fails, the credits come straight back.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing">
        <div className="shell">
          <div className="sec-head">
            <p className="eyebrow">Pricing</p>
            <h2 className="display">Pay for what you make</h2>
            <p>No monthly fee. No tier you forget to cancel. Credits sit in your account until you use them.</p>
          </div>

          <div className="packs">
            <div className="pack">
              <span className="pack-name">Starter</span>
              <span className="pack-price">₦2,000</span>
              <span className="pack-credits">2,000 credits</span>
              <span className="pack-bonus">{"\u00a0"}</span>
              <Link className="btn btn-ghost" href="/signin">Choose Starter</Link>
            </div>
            <div className="pack featured">
              <span className="pack-name">Creator</span>
              <span className="pack-price">₦5,000</span>
              <span className="pack-credits">5,250 credits</span>
              <span className="pack-bonus">+250 free</span>
              <Link className="btn btn-primary" href="/signin">Choose Creator</Link>
            </div>
            <div className="pack">
              <span className="pack-name">Business</span>
              <span className="pack-price">₦15,000</span>
              <span className="pack-credits">16,500 credits</span>
              <span className="pack-bonus">+1,500 free</span>
              <Link className="btn btn-ghost" href="/signin">Choose Business</Link>
            </div>
            <div className="pack">
              <span className="pack-name">Agency</span>
              <span className="pack-price">₦50,000</span>
              <span className="pack-credits">57,500 credits</span>
              <span className="pack-bonus">+7,500 free</span>
              <Link className="btn btn-ghost" href="/signin">Choose Agency</Link>
            </div>
          </div>

          <div className="price-strip">
            <div>5-second video from<b>₦300</b></div>
            <div>Image from<b>₦150</b></div>
            <div>Credits expire in<b>Never</b></div>
            <div>Failed generation<b>Refunded</b></div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="shell plain">
          <p className="eyebrow">Straight talk</p>
          <h2 className="display">There's no free plan</h2>
          <p>
            Every generation costs us money the moment you press the button, so there's no free tier and no
            trial. <strong>What you get instead:</strong> we're not funding a giveaway out of your subscription,
            we're not going to expire your credits after 90 days to force a renewal, and we don't need your card
            on file to charge you next month.
          </p>
          <p>
            You buy credits. You spend them when you want. If a generation fails, you get them back.
          </p>
        </div>
      </section>

      <footer>
        <div className="shell foot">
          <a className="wordmark" href="#top"><span className="mark" />Meerah</a>
          <div className="foot-links">
            <a href="#voice">MyVoice</a>
            <a href="#tools">Tools</a>
            <Link href="/pricing">Pricing</Link>
            <a href="#how">How it works</a>
          </div>
          <p className="foot-note">
            Built in Nigeria, for Nigerian creators, vendors, agents and agencies. Prices in Naira.
            Payments handled by Paystack.
          </p>
        </div>
      </footer>
    </>
  );
}
