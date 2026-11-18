# Survey Chart — design direction

**Movement: Hydrographic Survey.** The board is not a list of companies; it is a
nautical chart of protocols sounded before any ticker exists. A sounding is a
single depth reading taken at a point; here each rank is a bearing and each
implied value is a depth. The whole page behaves like a chart table: a narrow
survey rail holds the mark, the as-of stamp and the legend; the body holds the
depth chart. Faint contour lines run behind the rows like bathymetric
iso-lines. This is the visual grammar of measurement, not of a startup
dashboard.

**Why this subject, this look.** A pre-token protocol is uncharted water. The
chart metaphor is literal, not decorative: soundings, bearings, depth, a
survey card. Every structural device earns its place as navigation. The
headline is "The map before the ticker". Words stay few; the readings carry
the meaning. Information lives in the spacing, the rules and the numerals.

**Colour — one warm, one cool.** Chart navy `#071a24` ground, inner navy
`#0c2733` for the recessed table, chart paper `#e8ddc4` for the records,
sea-glass `#5ce0c6` as the single cool signal (depth readings, live marks),
coral `#ff6b4a` as the single warm accent (rank-one sounding, warnings),
muted ink `#91a9b3` for secondary text. No acid green, no purple gradient, no
glassmorphism. The navy is a chart table, not a "dark mode" skin.

**Type — three jobs, no costume.** A serif display face (`Iowan Old Style`,
`Palatino Linotype`, Georgia) sets the headline and the large count reading.
A system sans carries labels and prose in sentence case. Monospace is reserved
only for numeric readings and arithmetic, where tabular digits are the point.
No tracked-out ALL-CAPS eyebrow above every section. No em-dash word-fragments.
No arrow appended to controls.

**Structure.** Rail / main column split. The main column opens on the headline
and one large count reading, then inline "bearing" controls (search, category,
pre-token vs live), then a bordered depth-chart table with a sticky header,
then a survey-card detail drawer. Controls are understated and aligned, not a
row of identical rounded cards. One corner radius scale: cards `4px`, inputs
`2px`, pills for the toggle only. Generous space, short line lengths, left
alignment. Depth lines behind rows give rhythm without decoration.

**Craft discipline.** Each contour, hairline and numeral is placed by hand;
the spacing is the product of patient refinement, not an accident of a
framework. The final pass removes any mark that does not help a reader take a
bearing, keeps the character that makes the page unmistakably a survey chart,
and never substitutes a template for that character. Motion is one quiet
ease-out on drawer open and respects reduced motion. Keyboard focus is a
sea-glass ring. Responsive down to 820 px, where the rail folds above the main
column and the table keeps its readings.

**Data honesty.** The model is one data-driven function, `impliedValue`, over
TVL, seven-day change, tenure, category percentile and chain breadth. TVL is
compressed with a `0.86` exponent so a giant cannot bury a fast-growing peer;
a hundred-fold TVL gap becomes roughly fifty-fold, leaving room for growth and
age to matter. Live-token protocols are kept in a separate `live` array beside
the board and never ranked. The detail card shows every input and the
substituted arithmetic. Farm plans are concrete, costed, timed and verifiable;
they never promise a token.
