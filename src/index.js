require('dotenv').config()

const Telegraf = require('telegraf')
const { session } = Telegraf
const { BOT_TOKEN, PAGE_SIZE, FIXED_LENGTH } = process.env
const { getTokenETH, getUSD } = require('./graphql-api');
const tokens = require('./tokens.json');

const debug = (data) => () => {}

const formattedTime = (date) => date.toTimeString()
const formattedDate = (date) => date.toDateString()
const formattedDateTime = (date) => `${formattedDate(date)} ${formattedTime(date)}`

const bot = new Telegraf(BOT_TOKEN)

bot.use(session())

const pagination = (namespace, page, total) => {
  return ({
    reply_markup: {
      inline_keyboard: [[
        page !== 0
          ? { text: `< Prev ${PAGE_SIZE}`, callback_data: `/${namespace}/prev` }
          : { text: '----------', callback_data: '/noop' },
        {
          text: `${page * PAGE_SIZE} - ${(page + 1) * PAGE_SIZE} (${total})`,
          callback_data: '/noop',
        },
        page !== (total / PAGE_SIZE) - 1
          ? { text: `Next ${PAGE_SIZE} >`, callback_data: `/${namespace}/next` }
          : { text: '----------', callback_data: '/noop' },
      ]],
    },
  })
}

const getTokenRate = async (token) => {
  const tokenETH = await getTokenETH(token.symbol);
  const USD = await getUSD();
  const tokenUSD = tokenETH / USD;

  return {
    name: token.name,
    symbol: token.symbol,
    price_usd: tokenUSD,
    price_eth: tokenETH,
  }
}

const getRates = async (start = 0, limit = 50) => {

  const rates = [];

  for (let i = +start; i < +start + +limit; i++) {
    const t = tokens[i];
    const rate = await getTokenRate(t);
    rates.push(rate);
  }

  return rates;
}

const templateMd = ({ name, symbol, price_usd, price_eth
}) => `${name} *(${symbol})* \`!${symbol.toLowerCase()}\`
\`\`\`
==================
ETH ${price_eth.toFixed(FIXED_LENGTH)}
$   ${price_usd.toFixed(FIXED_LENGTH)}
==================
\`\`\``;

const smallTemplateMd = ({ name, symbol, price_usd, price_eth }) => `
${name} *(${symbol})* \`!${symbol.toLowerCase()}\`
\`\`\`
ETH ${price_eth.toFixed(FIXED_LENGTH)} | $ ${price_usd.toFixed(FIXED_LENGTH)}
\`\`\``

const mapCommands = async (tokens) => tokens.reduce((acc, token) => {
  const command = token.symbol.toLowerCase()

  bot.hears(`!${command}`, async (ctx) => {

    const msgData = await getTokenRate(token);

    let text = templateMd(msgData)
    await ctx.replyWithMarkdown(
      `${text}\nUpdated: ${formattedTime(new Date()).slice(0, 8)}`
    ).catch((error) => {
      debug(error)
      clearInterval(intervalId)
    })
  })

  acc[command] = 1

  return acc
}, {})

bot.hears('!rates', async (ctx) => {
  ctx.session.ratesPage = ctx.session.ratesPage || 0

  const data = await getRates(
    ctx.session.ratesPage * PAGE_SIZE,
    (ctx.session.ratesPage * PAGE_SIZE) + PAGE_SIZE
  )

  await ctx.replyWithMarkdown(
    data.map(smallTemplateMd).join(''),
    pagination('rates', ctx.session.ratesPage, Object.keys(ctx.index).length),
  ).catch(debug)
})

bot.hears('!time', async (ctx) => {
  const message = await ctx.replyWithMarkdown(formattedDateTime(new Date()))
    .catch(debug)

  const intervalId = setInterval(async () => {
    await ctx.tg.editMessageText(
      ctx.chat.id,
      message.message_id,
      undefined,
      formattedDateTime(new Date())
    ).catch((error) => {
      debug(error)
      clearInterval(intervalId)
    })
  }, 3000)
})

bot.hears('!list', async (ctx) => {
  const text = tokens.map(key => `\n${key.name} \`!${key.symbol.toLowerCase()}\``).join('');
  await ctx.replyWithMarkdown(text)
})

bot.action(/^\/rates\/(\w+)$/, async (ctx) => {
  const current = ctx.session.ratesPage || 0
  const allKeys = Object.keys(ctx.index)

  switch (ctx.match[1]) {
    case 'prev':
      ctx.session.ratesPage = current > 0
        ? current - 1
        : 0
      break
    case 'next':
      ctx.session.ratesPage = current < (allKeys.length / PAGE_SIZE) - 1
        ? current + 1
        : (allKeys.length / PAGE_SIZE) - 1
      break
    default:
  }

  const data = await getRates(ctx.session.ratesPage * PAGE_SIZE, PAGE_SIZE)
    .catch(debug)

  await ctx.editMessageText(
    data.map(smallTemplateMd).join(''),
    {
      disable_web_page_preview: true,
      parse_mode: 'Markdown',
      ...pagination('rates', ctx.session.ratesPage, allKeys.length),
    }
  ).catch(debug)
})

bot.action(/^\/noop$/, async (ctx) => ctx.answerCbQuery())

bot.command('start', async (ctx) => {
  await ctx.replyWithMarkdown(`Use \`/help\` to show list of commands`);
})

bot.command('help', async (ctx) => {
  await ctx.replyWithMarkdown(`
*Usage:*

\`!list\` - List of all supported currencies without rates
\`!rates\` - Paginated list of all supported currencies with rates
\`!{TICKER}\` - Show rate of exact currency by its ticker
`);
})

const run = async (instance) => {
  instance.context.index = await mapCommands(tokens)
  return instance
}

run(bot).then((instance) => {
  instance.startPolling()
  console.log('bot is started')
})
