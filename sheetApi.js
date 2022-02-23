// Import dependencies
// const fs = require("fs");
const { google } = require("googleapis");

const service = google.sheets("v4");
const credentials = require("./credentials.json");
const moment = require('moment');
const twilio = require('twilio');

// SMS service
var accountSid = process.env.TWILIO_ACCOUNT_SID; // Your Account SID from www.twilio.com/console
var authToken = process.env.TWILIO_AUTH_TOKEN;   // Your Auth Token from www.twilio.com/console

var client = new twilio(accountSid, authToken);


// Configure auth client
const authClient = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
);

module.exports = {
    readCsvFromGoogleForm: async function (req, res) {
        try {

            // Authorize the client
            const token = await authClient.authorize();
    
            // Set the client credentials
            authClient.setCredentials(token);
    
            // Get the rows
            const response = await service.spreadsheets.values.get({
                auth: authClient,
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: "A:M",
            });
    
            // All of the customer responses
            const answers = [];
    
            // Set rows to equal the rows
            const rows = response.data.values;
    
            // Check if we have any data and if we do add it to our answers array
            if (rows.length) {
    
                // Remove the headers
                rows.shift()
    
                // For each row
                for (const row of rows) {
                    answers.push({ 
                        timeStamp: row[0], 
                        orderType: row[1],
                        customerName: row[2],
                        phone: row[3],
                        pickupDate: row[4],
                        largeQty: row[5],
                        mediumQty: row[6],
                        smallQty: row[7],
                        miniQty: row[8],
                        deposit: row[9],
                        pickupMethod: row[10],
                        deliveryAddress: row[11],
                        notes: row[12],
                    });
                }
    
            } else {
                console.log("No data found.");  
            }

            return res.send(JSON.stringify(answers));;
    
        } catch (error) {
    
            // Log the error
            console.log(error);
    
            // Exit the process with error
            process.exit(1);
    
        }
    },

    writeValuesToGoogleResponse: async function (req, res) { // mark the items to be displayed on invoice.

        let sizeNameMap = {
            largeQty: '大 Large:',
            mediumQty: '中 Medium:',
            smallQty: '小Small:',
            miniQty: '迷你 Extra-small:'
        }

        let prices = {
            largeQty: 1580,
            mediumQty: 1380,
            smallQty: 1180,
            miniQty: 550
        }
        
        try {
            
            // Authorize the client
            const token = await authClient.authorize();

            // Set the client credentials
            authClient.setCredentials(token);
    
            // Get the rows
            const response = await service.spreadsheets.values.get({
                auth: authClient,
                spreadsheetId: "1cC37Oa-QP0Vy6CDt0QTi305TmnfZ_TpqabVQ-TaomXw",
                range: "A:O",
            });

            // All of the customer responses
            const answers = [];
            // Set rows to equal the rows
            const rows = response.data.values;

            // Check if we have any data and if we do add it to our answers array
            if (rows.length) {

                // Remove the headers
                rows.shift()
                // For each row
                for (const [i, row] of rows.entries()) {

                    console.log(moment(row[0]).format('LLLL'));
                    
                    let value = [];
                    let record = {
                        orderType: row[1],
                        customerName: row[2],
                        phone: row[3],
                        pickupDate: row[4],
                        purchasedItems: [],
                        deposit: row[9],
                        pickupMethod: row[10],
                        deliveryAddress: row[11],
                        notes: row[12],
                    };

                    if (!!row[5]) {
                        value.push(sizeNameMap['largeQty']);
                        value.push(row[5]);
                        record.purchasedItems.push({
                            largeQty: row[5],
                        })
                    }
                    if (!!row[6]) {
                        value.push(sizeNameMap['mediumQty']);
                        value.push(row[6]);
                        record.purchasedItems.push({
                            mediumQty: row[6],
                        })
                    }
                    if (!!row[7]) {
                        value.push(sizeNameMap['smallQty']);
                        value.push(row[7]);
                        record.purchasedItems.push({
                            smallQty: row[7],
                        })
                    }
                    if (!!row[8]) {
                        value.push(sizeNameMap['miniQty']);
                        value.push(row[8]);
                        record.purchasedItems.push({
                            miniQty: row[8],
                        })
                    }
                    
                    // write to sheet colum N-U
                    var values = [
                        value
                    ];

                    var body = {
                        values: values
                    };


                    if (!row[14] || row[14] == '') {
                        console.log(row[3] + 'updating');
                        await service.spreadsheets.values.update({
                            auth: authClient,
                            spreadsheetId: "1cC37Oa-QP0Vy6CDt0QTi305TmnfZ_TpqabVQ-TaomXw",
                            range: `O${i+2}:V${i+2}`,
                            valueInputOption: 'USER_ENTERED',
                            resource: body
                        });
                    }

                    // send SMS only if orderType == 'whatsapp'
                    if (row[1] == 'Whatsapp' && row[13] != 'TRUE') {
                        console.log(`A message will be sent to ${record.customerName} of phone ${record.phone}`);
                        let totalAmount = 0;
                        let bodyText = `${record.customerName}，你好！ \n此為盛記麵家盆菜訂單的確認短訊。你的訂單內容為：\n\n`;
                        for (var rec of record.purchasedItems) {
                            for (var [k,v] of Object.entries(rec)) {
                                console.log(`${k}, ${v}`);
                                console.log(sizeNameMap[k]);
                                totalAmount += prices[k]*v;
                                bodyText += `${sizeNameMap[k]} ${v} 盆\n`
                                
                            }
                        };
                        bodyText += `\n取盆日期：${moment(record.pickupDate, 'DD/MM/YYYY').locale('zh-hk').format('LL')}`;
                        bodyText += `\n訂單總額：${totalAmount}`;
                        let amountRemaining = totalAmount - record.deposit;
                        if (amountRemaining == 0) bodyText += ` [已付全數]`; else bodyText += `\n仍需繳付：${amountRemaining}`;

                        bodyText += `\n取盆方法：`;

                        if (record.pickupMethod == `自取 Self-pickup`) bodyText += `自取`; else if (record.pickupMethod == `送貨 Delivery`) bodyText += `送貨`;

                        if (!!record.deliveryAddress) bodyText += `\n地址：${record.deliveryAddress}`;

                        if (!!record.notes) bodyText += `\n備註：${record.notes}`;

                        bodyText += `\n多謝惠顧盛記麵家。`;

                        console.log(bodyText);

                        try {
                            await client.messages.create({
                                body: bodyText,
                                to: `+852${record.phone}`,
                                from: '+85264507495'
                            });

                            await service.spreadsheets.values.update({
                                auth: authClient,
                                spreadsheetId: "1cC37Oa-QP0Vy6CDt0QTi305TmnfZ_TpqabVQ-TaomXw",
                                range: `N${i+2}`,
                                valueInputOption: 'USER_ENTERED',
                                resource: { values: [['true']] }
                            });
                        } catch (error) {
                            await service.spreadsheets.values.update({
                                auth: authClient,
                                spreadsheetId: "1cC37Oa-QP0Vy6CDt0QTi305TmnfZ_TpqabVQ-TaomXw",
                                range: `N${i+2}`,
                                valueInputOption: 'USER_ENTERED',
                                resource: { values: [['error']] }
                            });
                        }
                    }
                
                }

            } else {
                console.log("No data found.");  
            }

              res.send({
                  result: 'ok'
              })

        } catch (error) {
            // Log the error
            console.log(error);
        }
    }
}
