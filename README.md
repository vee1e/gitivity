# Gitivity

A terminal-inspired GitHub repository analytics tool. Analyze contributions, track pull requests, and discover active contributors across projects with a minimalist monochrome interface.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/react-18.3-61DAFB.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.5-3178C6.svg)
![Vite](https://img.shields.io/badge/vite-5.4-646CFF.svg)

## Features

- **Repository Analysis** - Analyze any GitHub repository's contributors and PR activity
- **Organization Member Search** - Browse and search organization members with autocomplete
- **Contribution Statistics** - View detailed PR stats (merged, open, closed) per contributor
- **Terminal-Inspired UI** - Minimalist monochrome design with a clean, distraction-free interface
- **Smart Autocomplete** - Tab-complete repositories and members as you type
- **Responsive Design** - Works seamlessly on desktop and mobile devices
- **Lazy Loading** - Infinite scroll through organization repos and members
- **GitHub Token Support** - Optional PAT for higher API rate limits

## Quick Start

```bash
# Clone the repository
git clone https://github.com/vee1e/Gitivity.git
cd Gitivity

# Install dependencies
bun install

# Start development server
bun run dev
```

Open `http://localhost:5173` in your browser.

## Usage

### Repository Analysis

1. Enter a repository in the format `owner/repo` (e.g., `facebook/react`)
2. Select a time period (2 weeks to all time)
3. Click **Analyze** to fetch contribution data
4. Browse contributors and click on any user to see their detailed stats

### Organization Member Search

1. Toggle to **Member** mode
2. Type an organization name followed by `/` (e.g., `facebook/`)
3. Browse members with autocomplete (Tab to navigate, Enter to select)
4. Press Enter to view member contribution statistics

### Autocomplete Navigation

- **Tab** - Move down through suggestions
- **Shift + Tab** - Move up through suggestions
- **Enter** - Select highlighted item
- **Arrow Keys** - Alternative navigation
- **Escape** - Close dropdown

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **API**: GitHub REST API (via Octokit)
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Configuration

### GitHub Personal Access Token (Optional)

For higher API rate limits (5,000 requests/hour vs 60), add a GitHub PAT:

1. Click **Add Token** in the header
2. Create a token at [github.com/settings/tokens](https://github.com/settings/tokens) with `public_repo` scope
3. Paste your token and save

The token is stored locally in your browser and never sent to any server.

## Project Structure

```
src/
├── components/
│   ├── TokenSettings.tsx    # GitHub token configuration modal
│   └── UserStatsModal.tsx   # User contribution statistics modal
├── contexts/
│   └── ThemeContext.tsx     # Monochrome theme provider
├── utils/
│   ├── github.ts            # GitHub API integration
│   └── env.ts               # Environment & token management
├── App.tsx                  # Main application component
├── index.css                # Global styles & CSS variables
└── types.ts                 # TypeScript type definitions
```

## Development

```bash
# Install dependencies
bun install

# Start development server with hot reload
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Run ESLint
bun run lint
```

## API Rate Limits

Gitivity uses the GitHub API with the following limits:

- **Unauthenticated**: 60 requests/hour
- **Authenticated (with PAT)**: 5,000 requests/hour

A notification will appear if you're approaching the limit.

## Browser Compatibility

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

**Lakshit Verma** - [@vee1e](https://github.com/vee1e)

