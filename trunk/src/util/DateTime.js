
// formats unix timestamp to a H:M:S
export function unix2time(timestamp, locale='pl-PL') {
	let date = new Date(timestamp * 1000)
	return date.toLocaleTimeString(locale)
}