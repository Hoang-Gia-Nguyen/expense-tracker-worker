pipeline {
    agent {
        docker {
            image 'node:20'
        }
    }

    stages {
        stage('Install Dependencies') {
            steps {
                // Use ci for faster, more reliable builds in Jenkins
                sh 'npm ci'
            }
        }

        stage('Run Tests') {
            steps {
                // We use vitest with the junit reporter so Jenkins can display test results
                // We also use the --run flag to ensure vitest doesn't stay in watch mode
                sh 'npx vitest --run --reporter=default --reporter=junit --outputFile=test-results.xml'
            }
        }

        stage('Coverage') {
            steps {
                sh 'npx vitest run --coverage'
            }
        }
    }

    post {
        always {
            // Archive the JUnit test results
            junit 'test-results.xml'
        }
        success {
            // Archive coverage reports if needed
            archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true
        }
    }
}
