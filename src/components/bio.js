/**
 * Bio component that queries for data
 * with Gatsby's StaticQuery component
 *
 * See: https://www.gatsbyjs.org/docs/static-query/
 */

import React from "react"
import { StaticQuery, graphql } from "gatsby"
import Image from "gatsby-image"

import { rhythm } from "../utils/typography"

function Bio() {
  return (
    <StaticQuery
      query={bioQuery}
      render={data => {
        const { author, social, authorFirstName } = data.site.siteMetadata
        return (
          <div
            style={{
              display: `flex`,
              marginBottom: rhythm(2.5),
            }}
          >
            <Image
              fixed={data.avatar.childImageSharp.fixed}
              alt={author}
              style={{
                marginRight: rhythm(1 / 2),
                marginBottom: 0,
                minWidth: 50,
                borderRadius: `100%`,
              }}
              imgStyle={{
                borderRadius: `50%`,
              }}
            />
            <p>
              Hi, I'm <strong>{authorFirstName}</strong> 👋 I work remotely in Scotland where I also <a href="https://codeyourfuture.io/">teach</a>, cycle, 
              organise <a href="https://www.meetup.com/Glasgow-JavaScript/">GlasgowJS</a> & record training videos for <a href="https://egghead.io/instructors/rares-matei">Egghead</a>
              <br></br>
              Come say hi on
              {` `}
              <a href={`https://twitter.com/${social.twitter}`}>
                 Twitter
              </a>
              {` `}
              🐦
            </p>
          </div>
        )
      }}
    />
  )
}

const bioQuery = graphql`
  query BioQuery {
    avatar: file(absolutePath: { regex: "/profile-pic.jpg/" }) {
      childImageSharp {
        fixed(width: 50, height: 50) {
          ...GatsbyImageSharpFixed
        }
      }
    }
    site {
      siteMetadata {
        author
        authorFirstName
        social {
          twitter
        }
      }
    }
  }
`

export default Bio
