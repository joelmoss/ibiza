module.exports = api => {
  if (!api.env('test')) {
    return {}
  }

  return {
    plugins: ['lodash'],
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
