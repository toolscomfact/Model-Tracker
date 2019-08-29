# modeltracker
Http Restful API 를 통해 mongodb 를 게임/유저 별로 분리하여 관리하게 도와줍니다.

## Mongodb 설정
Node.js 의 mongodb_host 를 바꿔주시면 됩니다.

## Restful API
METHOD<t>URI<t>DESCRIPTION <br>
POST     /api/newgame        세션에 게임을 등록시킵니다. <br>
POST     /api/deletegame     세션에서 게임을 제거시킴과 동시에, 데이터베이스를 초기화합니다.  <br>
POST     /api/signup         사용자를 가입시킵니다. <br>
POST     /api/signin         로그인합니다. 액세스 토큰을 반환합니다. <br>
POST     /api/setversion     게임의 버전을 변경합니다. <br>
POST     /private/push       개인 document 를 컬렉션에 push 합니다. <br>
POST     /private/pull       개인 document 를 컬렉션에서 pull 합니다. <br>
POST     /private/update     개인 document 를 update 합니다. <br>
POST     /private/get        개인 document 를 얻어옵니다. Mongodb 의 Query 식을 사용합니다. <br>
