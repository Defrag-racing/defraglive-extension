import React from 'react'

function sanitizeString(text) {
    var element = document.createElement('div')
    element.innerText = text
    return element.innerHTML
}

// replaces ^7^2^... multiple colors next to each other with just one
const r_clean = /(\^[0-9a-z]){2,}/gi

// removes color codes from end of string
const r_end = /(\^[0-9a-z])+$/i

// Updated regex to match both numbers and letters a-z
const r_colors = /\^([0-9a-z]{1})(.?[^\^]+)/gi

export function Q3STR(props) {
    let newstr = sanitizeString(props.s)
    newstr = newstr.replace(r_clean, '$1')
    newstr = newstr.replace(r_end, '')
    newstr = newstr.replace(r_colors, '<span class="qcolor$1">$2</span>')

    return (
        <span dangerouslySetInnerHTML={{ __html: newstr }}/>
    )
}