const request = require('request')

request({url:'https://api.bithumb.com/public/ticker/BTC_KRW', method:'GET'}, function(err, resp, body) {
    console.log(Number(JSON.parse(body).data.closing_price))
})

