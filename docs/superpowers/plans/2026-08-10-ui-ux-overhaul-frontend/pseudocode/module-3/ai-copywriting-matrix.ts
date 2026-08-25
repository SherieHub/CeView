// ---- components/module-3/3.1-content-studio/AIContentMatrixPanel.tsx ----
imports: useState, apiClient, PlatformId type, CaptionOptionCard

props: MatrixSlotProps from './contentStudioTypes'
       { activePlatform, onPlatformChange, onStageCaption, stagedCaption }
// The shell (M3-F1) owns activePlatform and the staged draft; this card owns the tabs' and
// option cards' own rendering plus per-platform approval state. "Approve" calls
// onStageCaption(option.text) rather than writing any shared state itself.

const CHAR_LIMITS: Record<PlatformId, number>  // instagram/tiktok 2200, facebook 63206, naver 100000

function AIContentMatrixPanel():
  state: platform ← 'instagram', content ← apiClient.content.list() result,
         editedText ← {}, approved ← {instagram:null, tiktok:null, facebook:null, naver:null}

  approveOption(optionIndex, text):
    // only one option per platform approved at a time; approving never touches another platform
    approved[platform] ← optionIndex
    copy text into shared composer's `staged` field (Card 17 reads it)
    clear any existing audit result, reset agreement checkbox (Card 18 depends on this)

  options ← content.captions[platform].options  // Naver: 2, others: 3

  render: platform tab bar (gold dot if approved[p] != null) +
          Naver info banner if platform === 'naver' +
          options.map → CaptionOptionCard(text, charLimit, metadata (null for Naver), approved,
                                            onChange, onApprove)

// ---- components/module-3/3.1-content-studio/CaptionOptionCard.tsx ----
props: { text, charLimit, metadata, approved, onChange, onApprove }
state: showWhy ← false
overLimit ← text.length > charLimit
render: editable textarea + char counter (error state if overLimit) +
        "Why this caption" disclosure toggle (only if metadata non-null, revealing 5 dimensions) +
        Approve button
