import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the fitness tracker dashboard', () => {
  render(<App />);
  const linkElement = screen.getByText(/Daily Tracker/i);
  expect(linkElement).toBeInTheDocument();
});
