import type { ExplorableMeta } from '../../engine/meta';

export const meta: ExplorableMeta = {
  slug: 'tax-incidence',
  title: 'Who actually pays a tax',
  domain: 'economics',
  blurb:
    'A tax is written into law as falling on one side of a market. ' +
    'Where it actually lands depends on something else entirely.',
  minutes: 6,
  prerequisites: [],
  related: [],
  equation: 'P_{consumer} - P_{producer} = t',
  updated: '2026-08-18',

  // 1. Hook — a concrete situation where the default intuition is wrong.
  hook: [
    'In 2010 France cut restaurant VAT from 19.6% to 5.5%, expecting menu prices to fall by ' +
      'about the same amount. They fell by roughly a fiftieth of the cut. The rest stayed with ' +
      'the restaurants.',
    'Every tax debate is argued as though the question is who writes the cheque. It almost ' +
      'never is. The law names a payer; the market picks one, and the two need not agree.',
  ],

  // 2. Play — one opening prompt, no more.
  play: 'Drag the tax. Watch which of the two prices moves — and how far.',

  // 3. Reveal — the mechanism, after the reader has felt it.
  reveal: [
    'The tax opens a wedge between what buyers pay and what sellers keep. The wedge is always ' +
      'exactly the size of the tax. What the market decides is where to put the wedge: how much ' +
      'of it comes out of the buyer’s side and how much out of the seller’s.',
    'That split is settled by which side can more easily walk away. Elasticity is a measure of ' +
      'exactly that — how much the quantity changes when the price does. A side that can ' +
      'substitute, wait, or do without responds to a price change by leaving, and a side that ' +
      'leaves cannot be made to carry the tax. So the burden settles on whoever is more stuck.',
    'Written out, the share borne by consumers is the elasticity of supply over the sum of both ' +
      'elasticities. Note what does not appear anywhere in that expression: which side the law ' +
      'says must pay. Switch the tax between sellers and buyers and every number on the chart ' +
      'holds still.',
    'The quantity traded falls either way, and the trades that stop happening are pure loss — ' +
      'they were worth more to the buyer than they cost the seller, and now they do not occur. ' +
      'Nobody collects that value. It is the triangle, and it grows with the square of the tax.',
  ],

  // 4. Edges — challenge prompts the widget can actually answer.
  edges: [
    {
      prompt:
        'Find a setting where consumers bear essentially none of the tax. ' +
        'What is true about demand there?',
      answer:
        'Push elasticity of demand to 3.0 and elasticity of supply to 0.2. Consumers carry about ' +
        '6% of it. Highly elastic demand means buyers walk away rather than pay more, so sellers ' +
        'must absorb the tax to keep the sale. The burden lands on the side that cannot leave.',
      settings: { elasticity_d: 3, elasticity_s: 0.2, tax: 4 },
    },
    {
      prompt:
        'Move the tax from sellers to buyers. Predict what changes on the chart before you click.',
      answer:
        'Nothing changes. Both prices, the quantity, the revenue and the deadweight loss are ' +
        'identical. Only the labels move. Statutory incidence is a bookkeeping choice; economic ' +
        'incidence is set by the elasticities.',
      settings: { levied_on: 'buyers' },
    },
    {
      prompt:
        'Double the tax from 2 to 4 with both elasticities at 1. What happens to revenue, and ' +
        'what happens to deadweight loss?',
      answer:
        'Revenue less than doubles — it rises from about 180 to about 320 — because the tax also ' +
        'shrinks the quantity being taxed. Deadweight loss quadruples, from 10 to 40. The ' +
        'triangle scales with the square of the tax, which is why a lot of small taxes waste ' +
        'less than one large one.',
      settings: { elasticity_d: 1, elasticity_s: 1, tax: 4 },
    },
  ],

  // 5. Limits — which lie this model is telling.
  limits: [
    'Both curves here are straight lines, and real ones are not. Straight lines are honest near ' +
      'the equilibrium the model is anchored to and increasingly fictional away from it — the ' +
      'wider you drag the tax, the more the exact areas should be read as illustrative rather ' +
      'than measured.',
    'A single elasticity number stands in for a whole schedule of behaviour that in reality ' +
      'differs by buyer, by season, and above all by time horizon. Demand that looks rigid over ' +
      'a week is usually quite elastic over a year, so short-run and long-run incidence can land ' +
      'on opposite sides of a market.',
    'When elasticity of supply is below 1 the straight supply line implies producers would ' +
      'supply the first units at a negative price. That is the line being extrapolated past its ' +
      'meaning, not a claim about the world, so surplus below zero is clipped away rather than ' +
      'counted.',
    'This is one market considered alone. It has no substitutes gaining business next door, no ' +
      'labour market absorbing the shock, and no second round where the revenue gets spent. ' +
      'Deciding who really pays a tax in an economy requires all of that; this shows only the ' +
      'mechanism that the fuller account is built from.',
    'Nothing here says anything about whether the tax is a good idea. Deadweight loss is a cost, ' +
      'not a verdict — a tax that corrects pollution can be worth its triangle several times ' +
      'over, and this model cannot see that either way.',
  ],
};
