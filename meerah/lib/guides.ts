/**
 * What each tool does, for someone who has not used it before.
 *
 * A studio opens as a text box over an empty canvas, which tells a first-time
 * user nothing about what to type, what it will cost, or how long to wait. Every
 * tool answers the same questions here, in the same order, and the answers are
 * written for a small-business owner in Lagos rather than for someone who
 * already knows what a diffusion model is.
 *
 * The copy is deliberately vendor-free. Customers never see a model name, so
 * nothing here may name one either.
 */
export interface Guide {
  /** Imperative, what you came here to do. Sets the modal's headline. */
  headline: string;
  /** One line under the headline — the promise, in plain words. */
  tagline: string;
  /** The complete description: what this is, who it is for, what it replaces. */
  about: string;
  /** The three moves, in order. This is the whole workflow. */
  steps: { title: string; body: string }[];
  /** What the tool needs from you before it can run. */
  needs: string;
  /** Roughly how long, in plain terms. */
  takes: string;
  /** Things that make the result better. */
  tips: string[];
  /** What the settings panel on the left holds, for tools that have one. */
  panel?: string;
}

export const GUIDES: Record<string, Guide> = {
  videngine: {
    headline: 'Make a video from one sentence',
    tagline: 'Describe the shot, or start from a photo you already have.',
    about:
      'VidEngine is the general-purpose video tool — the one to reach for when you have an idea and no footage. ' +
      'Write what should happen and it films it; upload a photo first and it animates that instead, keeping the ' +
      'people and products in the picture. It stands in for the day you would have spent hiring a camera, a ' +
      'location and someone to edit, and it costs the price of one video rather than a day rate.',
    steps: [
      { title: 'Describe the shot',
        body: 'Write what happens in the video, the way you would tell a camera operator. One clear action beats three.' },
      { title: 'Add a photo, if you have one',
        body: 'Optional. Give it your product or your face and the video starts from that picture instead of inventing one.' },
      { title: 'Pick a quality and generate',
        body: 'Draft proves the idea for ₦300. When you like it, run the same words again at a higher quality.' },
    ],
    needs: 'A description of what should happen. A photo is optional — add one and the video starts from that picture.',
    takes: 'Draft is quickest, usually under a minute. Studio 4K takes the longest.',
    tips: [
      'Describe the movement, not just the scene: "camera pushes in slowly" beats "a market".',
      'Start on Draft to check the idea, then run the same prompt at a higher quality.',
      'One clear action works better than three competing ones.',
    ],
    panel: 'Your prompt, the source photo, quality, aspect ratio and length — with the price updating as you change them.',
  },

  vibereel: {
    headline: 'Bring a still photo to life',
    tagline: 'One photo in, a moving shot out.',
    about:
      'Vibe Reel takes a photograph you already own and adds motion to it — hair moving, fabric settling, the ' +
      'camera drifting slowly across the frame. It is the fastest way to turn a catalogue of product stills or ' +
      'a phone gallery into something that holds attention on a feed, without reshooting anything.',
    steps: [
      { title: 'Upload the photo', body: 'Any clear picture works. A single obvious subject moves most convincingly.' },
      { title: 'Say how it should move', body: 'A short note is enough: "slow push in", "wind through the leaves".' },
      { title: 'Generate', body: 'You get a short clip built from your photo, with the subject recognisably intact.' },
    ],
    needs: 'A photo, and a short note about the kind of motion you want.',
    takes: 'Usually under a minute.',
    tips: [
      'Photos with a clear subject and background move most convincingly.',
      'Small movements look real; large ones tend to distort.',
    ],
    panel: 'The photo you are animating, the motion note, and the quality and length of the clip.',
  },

  shotdirect: {
    headline: 'Direct a scene, shot by shot',
    tagline: 'Choose the camera move for each shot instead of accepting one.',
    about:
      'ShotDirector is for when a single clip is not enough and you want the piece cut like a film. You describe ' +
      'the scene once, then set each shot separately — wide, close, over-the-shoulder — and choose how the camera ' +
      'moves through it. It is the difference between a clip and a sequence, and it is what an advert or a music ' +
      'video needs to feel deliberate rather than generated.',
    steps: [
      { title: 'Set the scene', body: 'One description that every shot in the sequence shares — the place, the people, the light.' },
      { title: 'Choose your shots', body: 'Add each shot and pick its framing and camera move. Keep every shot to one idea.' },
      { title: 'Render the sequence', body: 'Each shot renders in turn, so this costs and takes longer than a single clip.' },
    ],
    needs: 'A description of the scene, then the camera moves shot by shot.',
    takes: 'Longer than a single clip, because it renders each shot.',
    tips: [
      'Name the shot type — wide, close, over-the-shoulder — and the move separately.',
      'Keep each shot to one idea; cut between them rather than cramming.',
    ],
    panel: 'The scene description, the shot list, and the camera move attached to whichever shot is selected.',
  },

  snipreel: {
    headline: 'Cut a long video into clips',
    tagline: 'Find the moments worth posting and take them out.',
    about:
      'Snip Reel is for footage you already have and no time to edit — a sermon, a lecture, a two-hour live ' +
      'stream, a podcast. It reads the video, finds the passages that stand on their own, and cuts them into ' +
      'short clips sized for a feed. You choose which of the suggestions to keep; nothing is posted for you.',
    steps: [
      { title: 'Add the long video', body: 'Upload the file or paste a link to it.' },
      { title: 'Let it find the moments', body: 'It reads the whole thing and proposes the passages that work alone.' },
      { title: 'Keep the ones you want', body: 'Review the suggested clips and download the ones worth posting.' },
    ],
    needs: 'A video to cut. Upload it or paste a link.',
    takes: 'Depends on how long the original is.',
    tips: [
      'Videos with clear speech cut better than music-only footage.',
      'Check the suggested clips before posting — you pick the final ones.',
    ],
    panel: 'The source video, how long the clips should be, and the aspect ratio you are cutting to.',
  },

  pixcraft: {
    headline: 'Make the picture you need',
    tagline: 'Product shots, flyers and thumbnails, without a studio.',
    about:
      'PixCraft is the image workhorse: the packshot for a listing, the flyer for a Saturday sale, the thumbnail ' +
      'that decides whether anyone clicks. Describe the picture and it makes it; add a reference and it follows ' +
      'that instead. Ask for several at once and pick the best — but note that each one is charged, and the price ' +
      'on the button already counts them.',
    steps: [
      { title: 'Describe the picture', body: 'Name the format out loud: "flyer", "packshot on white", "YouTube thumbnail".' },
      { title: 'Add a reference, if it helps', body: 'Optional. A picture to work from holds a product or a look steady.' },
      { title: 'Ask for a few and choose', body: 'Set how many you want. The price on the button covers all of them.' },
    ],
    needs: 'A description. A reference picture is optional.',
    takes: 'Seconds, usually.',
    tips: [
      'Say the format out loud — "flyer", "packshot on white", "YouTube thumbnail".',
      'Ask for up to four at once and pick the best; each one is charged.',
      'Name the lighting: "warm evening light" changes the result more than most words.',
    ],
    panel: 'Your description, any reference picture, how many to make, the shape of the image, and the running total.',
  },

  patchup: {
    headline: 'Fix a picture you already have',
    tagline: 'Replace part of it, remove something, or split it into layers.',
    about:
      'Patch Up edits rather than invents. Point at the part of a photograph you want changed and describe the ' +
      'change — a different background, a removed sign, a cleaner shelf. It can also separate a picture into ' +
      'layers, so the subject can be moved without disturbing what is behind it. Because a single job here can ' +
      'run several different operations, the price is quoted when you run it rather than before.',
    steps: [
      { title: 'Open the picture', body: 'Upload the photograph you want to change.' },
      { title: 'Point at what changes', body: 'Select the area, or split the image into layers to work on one part.' },
      { title: 'Describe the change', body: 'Say what should be there instead. One change at a time holds up best.' },
    ],
    needs: 'The picture, and what you want changed.',
    takes: 'Seconds for most edits.',
    tips: [
      'Edit one thing at a time; stacked changes drift from the original.',
      'Splitting into layers lets you move the subject without touching the background.',
    ],
    panel: 'The layer list, the selection tools, and the description of the change you are making.',
  },

  talksync: {
    headline: 'Make a face speak your script',
    tagline: 'The mouth matches the words, in any language you record.',
    about:
      'TalkSync puts your words in someone\'s mouth — a presenter for a product, an announcement from your own ' +
      'face, a spokesperson who is available at midnight. Give it a photo or a clip of a face and either an audio ' +
      'file or the words to say, and it matches the lips to the speech. It pairs naturally with SoundTrack: ' +
      'generate the voiceover there, bring it here.',
    steps: [
      { title: 'Choose the face', body: 'A photo or a short clip. Front-facing, with the mouth clearly visible.' },
      { title: 'Give it the words', body: 'Upload a voice recording, or type the script and let it be spoken.' },
      { title: 'Sync and generate', body: 'You get the same face, saying your words, with the mouth matched to them.' },
    ],
    needs: 'A photo or video of a face, and either audio or the words to say.',
    takes: 'Roughly a minute, longer for a long script.',
    tips: [
      'A front-facing face with the mouth visible works best.',
      'Keep the script to what fits comfortably in the clip length.',
    ],
    panel: 'The face you uploaded, the audio or script, and the quality of the finished clip.',
  },

  bodydouble: {
    headline: 'Keep the face, change everything else',
    tagline: 'The same person, in different clothes or a different setting.',
    about:
      'Body Double re-dresses someone without a second shoot. Film once, then show the same person in a new ' +
      'outfit, a new body, a new setting — their face carried through unchanged. For a clothing seller this is ' +
      'the whole catalogue from a single afternoon of filming.',
    steps: [
      { title: 'Upload the footage', body: 'A video of the person. Steady footage holds the face better than fast movement.' },
      { title: 'Describe the change', body: 'Plainly: fabric, colour, fit. "Cream linen shirt, loose, open collar."' },
      { title: 'Generate', body: 'The face is kept; the clothing and body follow your description.' },
    ],
    needs: 'A video of the person, and a description of the change.',
    takes: 'About a minute.',
    tips: [
      'Steady footage holds the face better than fast movement.',
      'Describe the clothing plainly: fabric, colour, fit.',
    ],
    panel: 'The source footage, the description of the change, and the output quality.',
  },

  starmaker: {
    headline: 'Build a face that stays the same',
    tagline: 'One character, recognisable across every post you make.',
    about:
      'Star Maker creates a person who does not exist and keeps them consistent. Build the face once, save it, ' +
      'and every picture you make afterwards shows the same individual rather than a new stranger. That ' +
      'consistency is what turns a scattered feed into a brand people recognise — and it is the reason to save ' +
      'the character rather than rebuild it each time.',
    steps: [
      { title: 'Choose the features', body: 'Age, face, build, style. Fewer strong choices hold up better than a long list.' },
      { title: 'Generate and refine', body: 'Look at the result, adjust, and run it again until the person is right.' },
      { title: 'Save the character', body: 'Saved characters can be reused everywhere. This is the step that makes it worth doing.' },
    ],
    needs: 'The features you want. Build it once and save it.',
    takes: 'Seconds.',
    tips: [
      'Save the character once you like it — reusing it is what keeps posts consistent.',
      'Fewer, stronger features hold up better across many pictures than a long list.',
    ],
    panel: 'The character\'s features, your saved characters, and the pose or scene you are placing them in.',
  },

  salesreel: {
    headline: 'Turn a product into an advert',
    tagline: 'Built for the shape and pace of Instagram and TikTok.',
    about:
      'Sales Reel is VidEngine pointed at one job: selling something. Give it your product and the line you want ' +
      'people to remember, and it builds a vertical clip paced for a feed — the product visible immediately, the ' +
      'message before the thumb moves. It is the cheapest advert you will run this month, and you can afford to ' +
      'test three versions of it.',
    steps: [
      { title: 'Show the product', body: 'A photo of it, or a description if you do not have one yet.' },
      { title: 'Write the message', body: 'What the advert should say. Short enough to land before anyone scrolls.' },
      { title: 'Generate vertical', body: '9:16 fills the screen on both apps. Make a few and run the one that performs.' },
    ],
    needs: 'Your product — a photo or a description — and what the advert should say.',
    takes: 'About a minute.',
    tips: [
      'Lead with the product in the first second; social video is scrolled past fast.',
      'Vertical (9:16) fills the screen on both apps.',
    ],
    panel: 'The product photo, the advert message, the aspect ratio, and the quality you are paying for.',
  },

  soundtrack: {
    headline: 'Give the video a voice',
    tagline: 'Background music, or a voiceover reading your script.',
    about:
      'SoundTrack makes the audio a video needs: a backing track in the genre you name, or a voice reading your ' +
      'words aloud. Silent video gets scrolled past, and licensed music is both expensive and a copyright claim ' +
      'waiting to happen. What you generate here is yours to use. Voiceovers made here drop straight into ' +
      'TalkSync when you want a face to say them.',
    steps: [
      { title: 'Choose music or voice', body: 'A track to play under the video, or a voice to read a script over it.' },
      { title: 'Describe it, or write it', body: 'For music, name the genre and the feel. For voice, type exactly what should be read.' },
      { title: 'Generate and download', body: 'Take the audio into your edit, or straight into TalkSync.' },
    ],
    needs: 'A description of the mood and style, or the words to be read.',
    takes: 'Under a minute for most tracks.',
    tips: [
      'Name the genre and the feel: "slow Afrobeats, hopeful, light percussion".',
      'For voiceover, punctuation controls the pacing — commas become pauses.',
      'Keep a voiceover to what fits the length of the video it sits under.',
    ],
    panel: 'The music or voice choice, your description or script, the length, and the price for it.',
  },

  appshelf: {
    headline: 'Tell us what to build next',
    tagline: 'Vote on the tools you actually want. Nothing is charged here.',
    about:
      'App Shelf is the one page that does not generate anything. It lists the tools being considered next, and ' +
      'you vote for the ones you would use. The most requested get built first. Nothing here costs a credit, and ' +
      'nothing here is a commitment — it is the shortest route between what you need and what we build.',
    steps: [
      { title: 'Read the shelf', body: 'Each entry says what the tool would do and who it is for.' },
      { title: 'Vote for what you need', body: 'Your votes are counted against your account, so one person cannot stack them.' },
      { title: 'Watch it arrive', body: 'The most requested tool becomes the next one built.' },
    ],
    needs: 'Just your votes. Nothing is charged.',
    takes: 'A moment.',
    tips: ['The most requested tools get built first.'],
    panel: 'The categories on the shelf, with a count each, and the running list of everything you have voted for.',
  },
};
