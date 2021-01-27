module.exports = {
  'plugins': [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        'changelogFile': 'docs/_includes/changelog.md'
      }
    ],
    '@semantic-release/npm',
    [
      '@semantic-release/github',
      {
        'assets': [
          {
            'path': 'dist/doggl-button-chrome-*.zip',
            'label': 'Doggl Button for Chrome'
          },
          {
            'path': 'dist/doggl-button-firefox-*.zip',
            'label': 'Doggl Button for Firefox'
          }
        ]
      }
    ],
    [
      '@semantic-release/git',
      {
        'assets': [
          'docs/_includes/changelog.md',
          'package.json',
          'package-lock.json'
        ]
      }
    ]
  ],
  'tagFormat': '${version}' // eslint-disable-line no-template-curly-in-string
};
