module.exports = api => {
  if (!api.env('test')) {
    return {}
  }

  return {
    presets: [
      [
        '@babel/preset-env',
        {
          targets: {
            node: 'current'
          }
        }
      ],
      [
        '@babel/preset-react',
        {
          runtime: 'automatic',
          development: true,
          useBuiltIns: true
        }
      ]
    ]
  }
}
