# Bale API cURL Examples

## Get Access Token

curl -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=AnUvTVryvJIZzHVTxfiPuOVxJKgaOHbj&client_secret=yvzKPmuMELIbywbApjTtUpoRcULZXlnk" \
  https://safir.bale.ai/api/v2/auth/token

## Send OTP

# Replace ACCESS_TOKEN, PHONE, and OTP
curl -X POST \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"98xxxxxxxxxx","otp":"123456"}' \
  https://safir.bale.ai/api/v2/send_otp