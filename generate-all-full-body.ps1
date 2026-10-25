$regions = @(
    "01_north_america_central_caribbean", "02_south_america", "03_western_europe_nordics",
    "04_eastern_europe_balkans_european_russia", "05_middle_east_caucasus", "06_north_africa_sahara_horn",
    "07_west_africa", "08_central_africa", "09_east_south_africa", "10_central_asia_siberia",
    "11_east_asia", "12_south_asia", "13_southeast_asia", "14_australia_oceania",
    "15_roma", "16_jewish_diaspora", "17_kurdish", "18_assyrian", "19_native_american",
    "20_maya", "21_andean"
)
$genders = @("women", "men", "trans")

foreach ($region in $regions) {
    foreach ($gender in $genders) {
        Write-Host "Generating full-body portraits for Region: $region, Gender: $gender..." -ForegroundColor Cyan
        node tools/generate-portraits.mjs --region $region --gender $gender --count 5 --provider pollinations --style bdsm --framing full
    }
}
Write-Host "All characters generated successfully!" -ForegroundColor Green
