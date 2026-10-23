import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it } from 'vitest';
import { TodayBarsProvider, TodayBarsButton, todayBarLabel, useTodayBarGroup } from '@/hooks/useTodayBars';
import { ReadingSection } from '@/components/today/TodaySections';

const reading = <ReadingSection todayRecord={null} lastBpLabel={null} customActions={[]} getLogCountForAction={() => 0} todayStr="2026-10-23" onPickReading={() => {}} onPickCustomAction={() => {}} onAddCustomAction={() => {}} />;

function Group({ scope }: { scope: string }) {
  const [more, setMore] = useState(false);
  const keys = more ? ['first', 'second'] : ['first'];
  const bars = useTodayBarGroup(scope, keys);
  return <div>{keys.map(key => <button key={key} aria-expanded={bars.isOpen(key)} onClick={() => bars.toggle(key)}>{scope} {key}</button>)}<button onClick={() => setMore(v => !v)}>{more ? 'Show less' : 'Show more'} {scope}</button></div>;
}
function Harness() {
  return <TodayBarsProvider><TodayBarsButton /><Group scope="given" /><Group scope="upcoming" />{reading}</TodayBarsProvider>;
}

it('uses Collapse all only when a nonempty set of visible bars is fully open', () => {
  expect(todayBarLabel([], {})).toBe('Expand all');
  expect(todayBarLabel(['a','b'], {a:true})).toBe('Expand all');
  expect(todayBarLabel(['a','b'], {a:true,b:false})).toBe('Expand all');
  expect(todayBarLabel(['a','b'], {a:true,b:true,hidden:false})).toBe('Collapse all');
});
it('follows manual taps, includes real record cards, and leaves Show more alone', () => {
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole('button', {name:'Expand all'}));
  expect(screen.getByRole('button', {name:'given first'})).toHaveAttribute('aria-expanded','true');
  expect(screen.getByRole('button', {name:'upcoming first'})).toHaveAttribute('aria-expanded','true');
  expect(screen.getByRole('button', {name:/^Record a reading/})).toHaveAttribute('aria-expanded','true');
  fireEvent.click(screen.getByRole('button', {name:/^Record a reading/}));
  expect(screen.getByRole('button', {name:'Expand all'})).toBeVisible();
  fireEvent.click(screen.getByRole('button', {name:/^Record a reading/}));
  expect(screen.queryByRole('button', {name:'given second'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name:'given first'}));
  expect(screen.getByRole('button', {name:'Expand all'})).toBeVisible();
  fireEvent.click(screen.getByRole('button', {name:'given first'}));
  expect(screen.getByRole('button', {name:'Collapse all'})).toBeVisible();
  fireEvent.click(screen.getByRole('button', {name:'Show more given'}));
  expect(screen.getByRole('button', {name:'given second'})).toHaveAttribute('aria-expanded','false');
  fireEvent.click(screen.getByRole('button', {name:'Expand all'}));
  expect(screen.getByRole('button', {name:'given second'})).toHaveAttribute('aria-expanded','true');
  fireEvent.click(screen.getByRole('button', {name:'Collapse all'}));
  for (const name of ['given first','given second','upcoming first']) expect(screen.getByRole('button',{name})).toHaveAttribute('aria-expanded','false');
  expect(screen.getByRole('button', {name:/^Record a reading/})).toHaveAttribute('aria-expanded','false');
  expect(screen.getByRole('button', {name:'Show less given'})).toBeVisible();
  view.unmount();render(<Harness />);
  expect(screen.getByRole('button', {name:'Expand all'})).toBeVisible();
  expect(screen.getByRole('button', {name:'given first'})).toHaveAttribute('aria-expanded','false');
});
it('keeps record cards usable without the Today provider', () => {
  render(reading);
  const button=screen.getByRole('button',{name:/^Record a reading/});
  expect(button).toHaveAttribute('aria-expanded','false');fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded','true');fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded','false');
});
it('disables the control when no covered bars are displayed', () => {
  render(<TodayBarsProvider><TodayBarsButton /></TodayBarsProvider>);
  expect(screen.getByRole('button', {name:'Expand all'})).toBeDisabled();
});
function LazyFold() {
  const bars=useTodayBarGroup('lazy',null);
  return <button aria-expanded={bars.isOpen('fold')} onClick={()=>bars.toggle('fold')}>Nested charts</button>;
}
function LazyCard() {
  const bars=useTodayBarGroup('lazy',['section','fold']);
  return <><button aria-expanded={bars.isOpen('section')} onClick={()=>bars.toggle('section')}>Charts card</button>{bars.isOpen('section')&&<LazyFold />}</>;
}
it('opens a lazy card and its registered fold in one action and keeps the registration after unmount', () => {
  render(<TodayBarsProvider><TodayBarsButton /><LazyCard /></TodayBarsProvider>);
  fireEvent.click(screen.getByRole('button',{name:'Expand all'}));
  expect(screen.getByRole('button',{name:'Nested charts'})).toHaveAttribute('aria-expanded','true');
  fireEvent.click(screen.getByRole('button',{name:'Nested charts'}));
  expect(screen.getByRole('button',{name:'Expand all'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Expand all'}));
  fireEvent.click(screen.getByRole('button',{name:'Collapse all'}));
  expect(screen.queryByRole('button',{name:'Nested charts'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Expand all'}));
  expect(screen.getByRole('button',{name:'Nested charts'})).toHaveAttribute('aria-expanded','true');
});
