import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttributionLink } from '../../../types';
import AdUrlBlock from './AdUrlBlock';

const setDestinationMock = vi.fn();

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    attributionLinks: {
      setDestination: (...args: unknown[]) => setDestinationMock(...args),
    },
  },
}));

const LINK: AttributionLink = {
  linkId: 'link-1',
  slug: 'k3f9dqmt',
  category: 'Coastal & Island',
  targetMarket: 'korea',
  destinationUrl: 'https://operator.example/book',
  hosted: false,
  windowStart: '2026-10-19T00:00:00+08:00',
  windowEnd: '2026-11-02T00:00:00+08:00',
  urls: {
    linkUrl: 'https://ceview.example/r/k3f9dqmt',
    metaAdUrl: 'https://ceview.example/r/k3f9dqmt?cmp={{campaign.id}}&set={{adset.id}}&ad={{ad.id}}',
    tiktokAdUrl: 'https://ceview.example/r/k3f9dqmt?cmp=__CAMPAIGN_ID__&set=__AID__&ad=__CID__',
  },
};

beforeEach(() => {
  setDestinationMock.mockReset();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('AdUrlBlock', () => {
  it('copies each of the three distinct strings from its own button', async () => {
    render(<AdUrlBlock link={LINK} onLinkChange={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Copy bare link' }));
    await userEvent.click(screen.getByRole('button', { name: 'Copy Meta ad URL' }));
    await userEvent.click(screen.getByRole('button', { name: 'Copy TikTok ad URL' }));

    expect(navigator.clipboard.writeText).toHaveBeenNthCalledWith(1, LINK.urls.linkUrl);
    expect(navigator.clipboard.writeText).toHaveBeenNthCalledWith(2, LINK.urls.metaAdUrl);
    expect(navigator.clipboard.writeText).toHaveBeenNthCalledWith(3, LINK.urls.tiktokAdUrl);
    expect(screen.getByText(/Paste this into your ad's URL parameters field in Ads Manager/i)).toBeInTheDocument();
    expect(screen.getByText(/Instagram captions do not make links tappable/i)).toBeInTheDocument();
  });

  it('renders nothing when no alert-derived link is available', () => {
    const { container } = render(<AdUrlBlock link={null} onLinkChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('round-trips from the operator page to CeView hosted mode', async () => {
    const hosted = { ...LINK, destinationUrl: null, hosted: true };
    setDestinationMock.mockResolvedValue(hosted);
    const onLinkChange = vi.fn();
    function Harness() {
      const [link, setLink] = useState(LINK);
      return <AdUrlBlock link={link} onLinkChange={(next) => { onLinkChange(next); setLink(next); }} />;
    }
    render(<Harness />);

    await userEvent.click(screen.getByRole('radio', { name: "Use CeView's booking form" }));
    await userEvent.click(screen.getByRole('button', { name: 'Save destination' }));

    await waitFor(() => expect(setDestinationMock).toHaveBeenCalledWith(LINK.linkId, null));
    expect(onLinkChange).toHaveBeenCalledWith(hosted);
    expect(screen.getByText("Current destination: CeView's booking form")).toBeInTheDocument();
  });

  it('saves an absolute operator destination and rejects unsafe input visibly', async () => {
    const onLinkChange = vi.fn();
    render(<AdUrlBlock link={{ ...LINK, destinationUrl: null, hosted: true }} onLinkChange={onLinkChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Send visitors to my own page' }));
    const input = screen.getByRole('textbox', { name: 'Destination URL' });
    await userEvent.type(input, '/relative/path');
    await userEvent.click(screen.getByRole('button', { name: 'Save destination' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a full http or https URL');
    expect(setDestinationMock).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, 'https://operator.example/new');
    setDestinationMock.mockResolvedValue({ ...LINK, destinationUrl: 'https://operator.example/new' });
    await userEvent.click(screen.getByRole('button', { name: 'Save destination' }));

    await waitFor(() => expect(setDestinationMock)
      .toHaveBeenCalledWith(LINK.linkId, 'https://operator.example/new'));
  });
});
